import {
  BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post,
  UnauthorizedException, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { TelegramService } from '../notifications/telegram.service';

/**
 * Contractul trimis de AIONA pentru o cerere.
 *
 * Până acum contractul venea pe Telegram, ca fişier. De aici înainte îl încarcă
 * administratorul în AIONA, iar AIONA îl trimite aici — partenerul îl descarcă
 * din aplicaţia lui, unde are deja dosarul clientului, îl tipăreşte şi îl
 * semnează. Se salvează ca document obişnuit al cererii, deci descărcarea şi
 * verificarea drepturilor merg prin codul care exista.
 *
 * Fără JWT: AIONA e alt sistem, nu un utilizator. În locul lui, acelaşi secret
 * comun cu care Ionix trimite cererile într-acolo.
 */
@ApiExcludeController()
@Controller('partener/applications')
export class AionaContractController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Actele clientului, cerute de AIONA.
   *
   * Se trimit la cerere, nu se copiază: buletinul rămâne într-un singur loc, la
   * noi. AIONA îl arată în fişă şi îl uită. Aceleaşi acte în două baze ar
   * însemna două locuri de apărat şi două de curăţat când clientul cere
   * ştergerea.
   */
  private verificaSecretul(secret?: string) {
    const asteptat = (process.env.IONIX_SECRET ?? '').trim();
    if (!asteptat) throw new BadRequestException('IONIX_SECRET nu e configurat.');
    if ((secret ?? '').trim() !== asteptat) throw new UnauthorizedException('Secret invalid.');
  }

  @Get(':id/documents')
  async documente(@Param('id') id: string, @Headers('x-ionix-secret') secret?: string) {
    this.verificaSecretul(secret);
    const docs = await this.prisma.document.findMany({
      where: { applicationId: id, type: { in: ['ID_FRONT', 'ID_BACK', 'SELFIE', 'OTHER'] } },
      orderBy: { type: 'asc' },
    });
    const iesire: any[] = [];
    for (const d of docs) {
      const cale = this.documents.getAbsolutePath(d.path);
      if (!fs.existsSync(cale)) continue;
      iesire.push({
        id: d.id,
        // AIONA numeşte feţele buletinului FRONT/BACK; noi ID_FRONT/ID_BACK.
        kind: d.type === 'ID_FRONT' ? 'FRONT' : d.type === 'ID_BACK' ? 'BACK' : d.type,
        mimeType: d.mimeType,
        data: fs.readFileSync(cale).toString('base64'),
        createdAt: d.createdAt,
      });
    }
    return iesire;
  }

  /**
   * Statusul, venit din AIONA.
   *
   * Îl scriem direct, nu prin ApplicationsService: acolo fiecare schimbare
   * trimite starea înapoi în AIONA, iar de aici ar începe un du-te-vino fără
   * sfârşit — ei ne spun, noi le spunem, ei ne spun. Ce vine dinspre AIONA
   * rămâne la noi.
   *
   * Blocarea funcţionează de la sine: butonul „preia" din Telegram merge doar
   * pe cereri în aşteptare, deci o cerere luată în AIONA nu mai poate fi luată
   * şi acolo.
   */
  @Post(':id/status')
  async primesteStatus(
    @Param('id') id: string,
    @Body() body: { status?: string; changedByName?: string },
    @Headers('x-ionix-secret') secret?: string,
  ) {
    this.verificaSecretul(secret);
    const permise = ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'];
    const status = String(body?.status ?? '').toUpperCase();
    if (!permise.includes(status)) throw new BadRequestException('Status necunoscut.');

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { partner: true },
    });
    if (!app) throw new NotFoundException('Cererea nu există.');
    if (app.status === status) return { ok: true, neschimbat: true };

    await this.prisma.application.update({
      where: { id },
      data: {
        status: status as any,
        statusChangedByName: body?.changedByName?.trim() || 'AIONA',
        statusChangedByTelegramUsername: null,
      },
    });

    // Cardul din grup arată noua stare. Fără await: dacă botul partenerului e
    // oprit, schimbarea s-a făcut oricum.
    void this.telegram.sendStatusUpdate(id, status, undefined, {
      token: app.partner?.telegramBotToken ?? undefined,
      chatId: app.partner?.telegramChatId ?? undefined,
      enabled: app.partner?.telegramEnabled,
    });

    return { ok: true };
  }

  /**
   * Contractul a rămas fără răspuns — AIONA ne cere să-l anunţăm pe cel care
   * a depus cererea. Vezi `TelegramService.sendContractReminder`.
   */
  @Post(':id/contract-reminder')
  async amintesteContractul(
    @Param('id') id: string,
    @Body() body: { zile?: number },
    @Headers('x-ionix-secret') secret?: string,
  ) {
    this.verificaSecretul(secret);
    const app = await this.prisma.application.findUnique({ where: { id }, select: { contractOutcome: true } });
    if (!app) throw new NotFoundException('Cererea nu există.');
    // Marcat între timp la noi, dar încă nu ajuns în AIONA: nu-l mai deranjăm.
    if (app.contractOutcome) return { ok: true, trimis: false };
    const zile = Math.max(1, Math.floor(Number(body?.zile) || 3));
    const trimis = await this.telegram.sendContractReminder(id, zile);
    return { ok: true, trimis };
  }

  @Post(':id/contract')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async primesteContract(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
    @Headers('x-ionix-secret') secret?: string,
  ) {
    this.verificaSecretul(secret);
    if (!file) throw new BadRequestException('Lipseşte fişierul.');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Contractul trebuie să fie PDF.');

    const app = await this.prisma.application.findUnique({ where: { id }, select: { id: true } });
    if (!app) throw new NotFoundException('Cererea nu există.');

    // Un contract nou îl înlocuieşte pe cel vechi: partenerul trebuie să
    // tipărească ultima variantă, nu să aleagă între două.
    await this.documents.deleteByType(id, 'CONTRACT');

    const doc = await this.documents.saveFile(file, id, 'CONTRACT');

    // Partenerul află din Telegram că are ce tipări. Fără await: dacă botul lui
    // e oprit sau prost configurat, contractul tot a ajuns — nu are rost să
    // răspundem cu eroare către AIONA pentru un anunţ neplecat.
    void this.telegram.sendContractReady(id);

    return { id: doc.id, received: true };
  }
}
