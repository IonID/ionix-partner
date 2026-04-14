import { Injectable, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { CalculateDto } from './dto/calculate.dto';

export interface AmortizationRow {
  month: number;
  payment: number;       // total monthly payment
  principal: number;     // principal component
  interest: number;      // interest component
  balance: number;       // remaining balance
}

export interface CalculationResult {
  creditType: string;
  amount: number;
  months: number;
  monthlyRate: number;          // decimal form, e.g. 0.0299
  monthlyPayment: number;
  totalAmount: number;          // VTP — Valoarea Totala de Plata
  totalInterest: number;
  dae: number;                  // DAE — Dobânda Anuală Efectivă (%)
  processingFee: number;
  commissionAmount: number;
  schedule: AmortizationRow[];
}

@Injectable()
export class CalculatorService {
  constructor(private readonly settings: SettingsService) {}

  async calculate(dto: CalculateDto, commissionRate: number): Promise<CalculationResult> {
    const { creditType, amount, months } = dto;

    // ── Load settings from DB ──────────────────────────────────────
    const s = await this.settings.getAll();
    const processingFeeRate = parseFloat(s['PROCESSING_FEE_RATE'] ?? '0.01');
    const processingFee = amount * processingFeeRate;

    if (creditType === 'ZERO') {
      return this.calculateZero({ amount, months, processingFee, commissionRate, s });
    } else {
      return this.calculateClassic({ amount, months, processingFee, commissionRate, s });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Credit Zero — 0% dobândă, rate egale
  // ─────────────────────────────────────────────────────────────────
  private async calculateZero(params: {
    amount: number;
    months: number;
    processingFee: number;
    commissionRate: number;
    s: Record<string, string>;
  }): Promise<CalculationResult> {
    const { amount, months, processingFee, commissionRate, s } = params;

    const minAmount = parseFloat(s['ZERO_MIN_AMOUNT'] ?? '500');
    const maxAmount = parseFloat(s['ZERO_MAX_AMOUNT'] ?? '10000');
    const minMonths = parseInt(s['ZERO_MIN_MONTHS'] ?? '3');
    const maxMonths = parseInt(s['ZERO_MAX_MONTHS'] ?? '12');

    this.validateRange(amount, minAmount, maxAmount, 'sumă', 'ZERO');
    this.validateRange(months, minMonths, maxMonths, 'termen', 'ZERO');

    const monthlyPayment = this.round2(amount / months);
    const totalAmount = this.round2(monthlyPayment * months + processingFee);
    const totalInterest = 0;
    const commissionAmount = this.round2(amount * commissionRate / 100);

    // DAE for zero-interest credit — only fee applies
    // Using IRR Newton-Raphson for accuracy
    const dae = this.round2(this.calculateDAE(amount, monthlyPayment, months, processingFee) * 100);

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
      totalAmount,
      totalInterest,
      dae,
      processingFee: this.round2(processingFee),
      commissionAmount,
      schedule,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Credit Clasic — amortizare standard (anuitate)
  // ─────────────────────────────────────────────────────────────────
  private async calculateClassic(params: {
    amount: number;
    months: number;
    processingFee: number;
    commissionRate: number;
    s: Record<string, string>;
  }): Promise<CalculationResult> {
    const { amount, months, processingFee, commissionRate, s } = params;

    const monthlyRate = parseFloat(s['CLASSIC_MONTHLY_RATE'] ?? '0.0299');
    const minAmount = parseFloat(s['CLASSIC_MIN_AMOUNT'] ?? '1000');
    const maxAmount = parseFloat(s['CLASSIC_MAX_AMOUNT'] ?? '50000');
    const minMonths = parseInt(s['CLASSIC_MIN_MONTHS'] ?? '3');
    const maxMonths = parseInt(s['CLASSIC_MAX_MONTHS'] ?? '24');

    this.validateRange(amount, minAmount, maxAmount, 'sumă', 'CLASIC');
    this.validateRange(months, minMonths, maxMonths, 'termen', 'CLASIC');

    // ── Annuity formula: P * [r(1+r)^n] / [(1+r)^n - 1] ──────────
    const r = monthlyRate;
    const n = months;
    const factor = Math.pow(1 + r, n);
    const monthlyPayment = this.round2((amount * r * factor) / (factor - 1));

    const totalAmount = this.round2(monthlyPayment * months + processingFee);
    const totalInterest = this.round2(totalAmount - amount - processingFee);
    const commissionAmount = this.round2(amount * commissionRate / 100);

    // DAE = (1 + r_monthly)^12 - 1  expressed as percentage
    const dae = this.round2((Math.pow(1 + r, 12) - 1) * 100);

    // ── Amortization schedule ──────────────────────────────────────
    const schedule: AmortizationRow[] = [];
    let balance = amount;
    for (let i = 1; i <= months; i++) {
      const interest = this.round2(balance * r);
      const principal = this.round2(monthlyPayment - interest);
      balance = this.round2(balance - principal);
      if (i === months && Math.abs(balance) < 0.01) balance = 0; // fix floating point drift
      schedule.push({ month: i, payment: monthlyPayment, principal, interest, balance });
    }

    return {
      creditType: 'CLASSIC',
      amount, months,
      monthlyRate,
      monthlyPayment,
      totalAmount,
      totalInterest,
      dae,
      processingFee: this.round2(processingFee),
      commissionAmount,
      schedule,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  DAE via Newton-Raphson (for zero-interest loan w/ fee)
  //  Solves: amount = Σ payment/(1+r)^t for t=1..n, then DAE=(1+r)^12-1
  // ─────────────────────────────────────────────────────────────────
  private calculateDAE(principal: number, payment: number, months: number, fee: number): number {
    if (fee === 0) return 0;
    const totalPaid = payment * months + fee;
    // Initial guess: simple approximation
    let r = (totalPaid / principal - 1) / months;
    for (let iter = 0; iter < 100; iter++) {
      const f = this.npv(r, payment, months, principal);
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
