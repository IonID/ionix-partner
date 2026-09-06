import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsModule } from '../documents/documents.module';
import { AionaService } from './aiona.service';
import { AionaContractController } from './aiona-contract.controller';

@Module({
  imports: [PrismaModule, DocumentsModule],
  controllers: [AionaContractController],
  providers: [AionaService],
  exports: [AionaService],
})
export class AionaModule {}
