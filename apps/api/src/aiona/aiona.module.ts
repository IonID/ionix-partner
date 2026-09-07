import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AionaContractController } from './aiona-contract.controller';

/** Primirea contractului din AIONA şi anunţul către partener. */
@Module({
  imports: [PrismaModule, DocumentsModule, NotificationsModule],
  controllers: [AionaContractController],
})
export class AionaModule {}
