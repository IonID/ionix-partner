import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalculatorModule } from '../calculator/calculator.module';
import { AionaCoreModule } from '../aiona/aiona-core.module';
import { AuditModule } from '../audit/audit.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [DocumentsModule, NotificationsModule, CalculatorModule, AionaCoreModule, AuditModule, ReportsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
