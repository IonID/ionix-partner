import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalculatorService } from './calculator.service';
import { CalculateDto } from './dto/calculate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Calculator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calculator')
export class CalculatorController {
  constructor(
    private readonly calculatorService: CalculatorService,
    private readonly auditService: AuditService,
  ) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculează ratele unui credit' })
  async calculate(
    @Body() dto: CalculateDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    const commissionRate = user.partner?.commissionRate ?? 0;

    const result = await this.calculatorService.calculate(dto, commissionRate);

    await this.auditService.log({
      userId: user.id,
      action: 'CALCULATE',
      resource: 'calculator',
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        creditType: dto.creditType,
        amount: dto.amount,
        months: dto.months,
        monthlyPayment: result.monthlyPayment,
      },
    });

    return result;
  }
}
