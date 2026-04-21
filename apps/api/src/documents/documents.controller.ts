import { Controller, Get, Param, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/file')
  @ApiOperation({ summary: 'Descarcă / vizualizează un document (autentificat)' })
  async serveFile(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { application: true },
    });

    if (!doc) throw new NotFoundException('Documentul nu a fost găsit');

    // PARTNER can only access documents from their own partner company
    if (user.role !== Role.ADMIN) {
      const isMember = await this.prisma.user.findFirst({
        where: { id: user.id, partnerId: doc.application.partnerId },
      });
      if (!isMember) throw new NotFoundException('Documentul nu a fost găsit');
    }

    const filePath = this.documentsService.getAbsolutePath(doc.path);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Fișierul nu există pe disc');

    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${doc.originalName}"`,
      'Cache-Control': 'private, max-age=3600',
    });
    res.sendFile(path.resolve(filePath));
  }
}
