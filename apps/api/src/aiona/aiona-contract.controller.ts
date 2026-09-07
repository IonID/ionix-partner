import {
  BadRequestException, Controller, Get, Headers, NotFoundException, Param, Post,
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
