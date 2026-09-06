import {
  BadRequestException, Controller, Headers, NotFoundException, Param, Post,
  UnauthorizedException, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';

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
  ) {}

  @Post(':id/contract')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async primesteContract(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
    @Headers('x-ionix-secret') secret?: string,
  ) {
    const asteptat = (process.env.IONIX_SECRET ?? '').trim();
    if (!asteptat) throw new BadRequestException('IONIX_SECRET nu e configurat.');
    if ((secret ?? '').trim() !== asteptat) throw new UnauthorizedException('Secret invalid.');
    if (!file) throw new BadRequestException('Lipseşte fişierul.');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Contractul trebuie să fie PDF.');

    const app = await this.prisma.application.findUnique({ where: { id }, select: { id: true } });
    if (!app) throw new NotFoundException('Cererea nu există.');

    // Un contract nou îl înlocuieşte pe cel vechi: partenerul trebuie să
    // tipărească ultima variantă, nu să aleagă între două.
    await this.documents.deleteByType(id, 'CONTRACT');

    const doc = await this.documents.saveFile(file, id, 'CONTRACT');
    return { id: doc.id, received: true };
  }
}
