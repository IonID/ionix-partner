import {
  Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('backups')
export class BackupController {
  constructor(private svc: BackupService) {}

  @Get()
  @ApiOperation({ summary: 'Copiile de rezervă existente' })
  list(@CurrentUser() user: any) {
    return this.svc.list(user);
  }

  @Get('config')
  @ApiOperation({ summary: 'Unde se scriu şi cât se păstrează' })
  config(@CurrentUser() user: any) {
    return this.svc.config(user);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Face o copie acum' })
  run(@CurrentUser() user: any) {
    return this.svc.runManual(user);
  }

  /**
   * Descărcarea unei copii.
   *
   * `@Res()` fără `passthrough` dinadins: cu el, răspunsul ar trece mai departe
   * prin `TransformInterceptor`, care împachetează orice în `{ success, data }`.
   * Aşa, în loc de arhivă, browserul ar primi vreo 360 de octeţi de JSON care
   * descrie fluxul — un fişier care se salvează cu numele bun şi pe care nimeni
   * nu-l deschide până în ziua în care ar avea nevoie de el. S-a întâmplat în
   * AIONA, găsit pe 16.09.2026; aici îl ocolim din start.
   *
   * Fişierul se trimite în flux, nu citit întreg în memorie: arhiva de
   * documente poate trece de o sută de megabaiţi.
   */
  @Get(':name/download')
  @ApiOperation({ summary: 'Descarcă o copie' })
  download(@Param('name') name: string, @CurrentUser() user: any, @Res() res: Response) {
    const fp = this.svc.resolveFile(user, name);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${basename(fp)}"`);
    // Cu lungimea scrisă, browserul arată cât mai e şi observă o descărcare
    // ruptă la mijloc; fără ea, un fişier pe jumătate pare întreg.
    res.setHeader('Content-Length', String(statSync(fp).size));
    createReadStream(fp).pipe(res);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Şterge o copie' })
  remove(@Param('name') name: string, @CurrentUser() user: any) {
    return this.svc.remove(user, name);
  }
}
