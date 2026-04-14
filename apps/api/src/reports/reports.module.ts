import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { CalculatorModule } from '../calculator/calculator.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CalculatorModule, AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
