import { Injectable, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { CalculateDto } from './dto/calculate.dto';

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface CalculationResult {
  creditType: string;
  amount: number;
  months: number;
  monthlyRate: number;
  monthlyPayment: number;
  totalAmount: number;
  totalInterest: number;
  dae: number;
  processingFee: number;
  commissionAmount: number;
  zeroCommission?: number; // "Dobândă Compensată" — shown in UI for Zero, never in PDF
  schedule: AmortizationRow[];
}

// Fallback commission table: months → partner compensation %
const ZERO_COMMISSION_FALLBACK: Record<number, number> = {
  3: 4.0, 4: 5.0, 5: 6.0, 6: 7.0, 7: 8.0, 8: 9.0, 9: 10.0,
  10: 11.0, 11: 12.0, 12: 13.0, 13: 14.0, 14: 14.5, 15: 15.0,
  16: 16.0, 17: 17.0, 18: 18.0, 19: 19.0, 20: 20.0,
  21: 21.0, 22: 21.5, 23: 22.0, 24: 22.5,
};

@Injectable()
export class CalculatorService {
  constructor(private readonly settings: SettingsService) {}

  async calculate(dto: CalculateDto, commissionRate: number): Promise<CalculationResult> {
    const { creditType, amount, months } = dto;
    const s = await this.settings.getAll();

    return creditType === 'ZERO'
      ? this.calculateZero({ amount, months, s })
      : this.calculateClassic({ amount, months, commissionRate, s });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Credit Zero — rate egale, fără dobândă pentru client
  //  Partner primește "Dobândă Compensată" din tabelul global
  // ─────────────────────────────────────────────────────────────────
  private calculateZero(params: {
    amount: number;
    months: number;
    s: Record<string, string>;
  }): CalculationResult {
    const { amount, months, s } = params;

    const minAmount = parseFloat(s['ZERO_MIN_AMOUNT'] ?? '500');
    const maxAmount = parseFloat(s['ZERO_MAX_AMOUNT'] ?? '10000');
    const minMonths = parseInt(s['ZERO_MIN_MONTHS'] ?? '3');
    const maxMonths = parseInt(s['ZERO_MAX_MONTHS'] ?? '12');

    this.validateRange(amount, minAmount, maxAmount, 'sumă', 'ZERO');
    this.validateRange(months, minMonths, maxMonths, 'termen', 'ZERO');

    const commissionTable = this.parseCommissionTable(s['ZERO_COMMISSION_TABLE']);
    const commissionPct   = commissionTable[months] ?? 0;
    const zeroCommission  = this.round2(amount * commissionPct / 100);

    const monthlyPayment = this.round2(amount / months);

    const schedule: AmortizationRow[] = [];
    let balance = amount;
    for (let i = 1; i <= months; i++) {
      const principal = this.round2(i < months ? monthlyPayment : balance);
      balance = this.round2(balance - principal);
      schedule.push({ month: i, payment: monthlyPayment, principal, interest: 0, balance });
    }

    return {
      creditType: 'ZERO',
      amount, months,
      monthlyRate: 0,
      monthlyPayment,
      totalAmount:    amount,  // client returns exactly what was borrowed
      totalInterest:  0,
      dae:            0,
      processingFee:  0,
      commissionAmount: zeroCommission,
      zeroCommission,
      schedule,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Credit Clasic — anuitate + comision lunar de administrare
  //  monthlyPayment = annuity(20%/an) + amount × 1%/lună
  //  DAE calculat prin Newton-Raphson IRR
  // ─────────────────────────────────────────────────────────────────
  private calculateClassic(params: {
    amount: number;
    months: number;
    commissionRate: number;
    s: Record<string, string>;
  }): CalculationResult {
    const { amount, months, commissionRate, s } = params;

    const annualRate   = parseFloat(s['CLASSIC_ANNUAL_RATE']    ?? '0.20');
    const adminFeeRate = parseFloat(s['CLASSIC_ADMIN_FEE_RATE'] ?? '0.01');
    const minAmount    = parseFloat(s['CLASSIC_MIN_AMOUNT']     ?? '1000');
    const maxAmount    = parseFloat(s['CLASSIC_MAX_AMOUNT']     ?? '50000');
    const minMonths    = parseInt(s['CLASSIC_MIN_MONTHS']       ?? '3');
    const maxMonths    = parseInt(s['CLASSIC_MAX_MONTHS']       ?? '24');

    this.validateRange(amount, minAmount, maxAmount, 'sumă', 'CLASIC');
    this.validateRange(months, minMonths, maxMonths, 'termen', 'CLASIC');

    const r = annualRate / 12; // monthly interest rate
    const n = months;
    const factor = Math.pow(1 + r, n);

    // Annuity component (principal + interest)
    const annuityPayment  = this.round2((amount * r * factor) / (factor - 1));
    // Monthly admin fee on original amount (charged each month)
    const monthlyAdminFee = this.round2(amount * adminFeeRate);
    // Total monthly payment client sees
    const monthlyPayment  = this.round2(annuityPayment + monthlyAdminFee);

    const totalAdminFees = this.round2(monthlyAdminFee * months);
    const totalInterest  = this.round2(annuityPayment * months - amount);
    const totalAmount    = this.round2(monthlyPayment * months);
    const commissionAmount = this.round2(amount * commissionRate / 100 * months);

    // DAE via Newton-Raphson: solve amount = Σ monthlyPayment/(1+r)^t
    const dae = this.round2(this.calculateDAE(amount, monthlyPayment, months) * 100);

    // Amortization schedule (annuity basis; admin fee included in payment column)
    const schedule: AmortizationRow[] = [];
    let balance = amount;
    for (let i = 1; i <= months; i++) {
      const interest  = this.round2(balance * r);
      const principal = this.round2(annuityPayment - interest);
      balance = this.round2(balance - principal);
      if (i === months && Math.abs(balance) < 0.01) balance = 0;
      schedule.push({ month: i, payment: monthlyPayment, principal, interest, balance });
    }

    return {
      creditType: 'CLASSIC',
      amount, months,
      monthlyRate: r,
      monthlyPayment,
      totalAmount,
      totalInterest,
      dae,
      processingFee: totalAdminFees, // total admin fees over all months
      commissionAmount,
      schedule,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Newton-Raphson IRR: solve PV = Σ payment/(1+r)^t → DAE=(1+r)^12-1
  // ─────────────────────────────────────────────────────────────────
  private calculateDAE(principal: number, payment: number, months: number): number {
    let r = 0.01; // initial guess ≈ 12% annual
    for (let iter = 0; iter < 200; iter++) {
      const f  = this.npv(r, payment, months, principal);
      const df = this.dnpv(r, payment, months);
      const delta = f / df;
      r -= delta;
      if (Math.abs(delta) < 1e-10) break;
    }
    return Math.pow(1 + r, 12) - 1;
  }

  private npv(r: number, payment: number, months: number, principal: number): number {
    let sum = 0;
    for (let t = 1; t <= months; t++) sum += payment / Math.pow(1 + r, t);
    return sum - principal;
  }

  private dnpv(r: number, payment: number, months: number): number {
    let sum = 0;
    for (let t = 1; t <= months; t++) sum += (-t * payment) / Math.pow(1 + r, t + 1);
    return sum;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────────
  private parseCommissionTable(raw?: string): Record<number, number> {
    if (!raw) return ZERO_COMMISSION_FALLBACK;
    try {
      const parsed = JSON.parse(raw);
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [Number(k), Number(v)]),
      );
    } catch {
      return ZERO_COMMISSION_FALLBACK;
    }
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private validateRange(value: number, min: number, max: number, label: string, type: string) {
    if (value < min || value > max) {
      throw new BadRequestException(
        `${label} pentru Credit ${type} trebuie să fie între ${min} și ${max}`,
      );
    }
  }
}
