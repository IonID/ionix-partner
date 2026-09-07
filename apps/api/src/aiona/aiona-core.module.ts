import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AionaService } from './aiona.service';

/**
 * Doar trimiterea către AIONA.
 *
 * Stă separat de restul integrării ca să nu apară un cerc: notificările au
 * nevoie de serviciul acesta (ca să trimită la schimbarea statusului), iar
 * primirea contractului are nevoie de notificări (ca să anunţe partenerul).
 * Despărţite, lanţul e drept: core ← notificări ← contract.
 */
@Module({
  imports: [PrismaModule],
  providers: [AionaService],
  exports: [AionaService],
})
export class AionaCoreModule {}
