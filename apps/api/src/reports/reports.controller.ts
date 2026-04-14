import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CalculatorService } from '../calculator/calculator.service';
import { CalculateDto } from '../calculator/dto/calculate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly calculatorService: CalculatorService,
    private readonly auditService: AuditService,
  ) {}

  @Post('amortization-pdf')
  @ApiOperation({ summary: 'Generează PDF cu graficul de rambursare' })
  async generatePdf(
    @Body() dto: CalculateDto,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    const commissionRate = user.partner?.commissionRate ?? 0;
    const partnerName = user.partner?.companyName ?? 'Priminvestnord';

    const calc = await this.calculatorService.calculate(dto, commissionRate);
    const pdfBuffer = await this.reportsService.generateAmortizationPdf(calc, partnerName);

    await this.auditService.log({
      userId: user.id,
      action: 'DOWNLOAD_PDF',
      resource: 'reports',
      ipAddress: ip,
      metadata: { creditType: dto.creditType, amount: dto.amount, months: dto.months },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ionix-grafic-rambursare-${Date.now()}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
