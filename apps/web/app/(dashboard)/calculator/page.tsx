'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, TrendingUp, Download, Send, Loader2, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AmortizationTable } from '@/components/calculator/AmortizationTable';
import { api } from '@/lib/api';
import { formatMDL } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

type CreditType = 'ZERO' | 'CLASSIC';

interface CalcResult {
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
  zeroCommission?: number;
  schedule: Array<{ month: number; payment: number; principal: number; interest: number; balance: number }>;
}

function CalculatorInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  // Restore state from URL when coming back from the application form
  const initCreditType = (searchParams.get('creditType') as CreditType | null) ?? 'CLASSIC';
  const initAmount     = searchParams.get('amount')  ? Number(searchParams.get('amount'))  : 5000;
  const initMonths     = searchParams.get('months')  ? Number(searchParams.get('months'))  : 12;

  const [creditType, setCreditType] = useState<CreditType>(initCreditType);
  const [amount, setAmount]         = useState<number>(initAmount);
  const [months, setMonths]         = useState<number>(initMonths);
  const [result, setResult]         = useState<CalcResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Credit Zero — suma produsului (două câmpuri cu legătură bidirecțională)
  const [productAmountStr, setProductAmountStr] = useState<string>(String(initAmount));
  const productFocusedRef = useRef(false);

  // Câmpurile numerice editabile țin text liber cât timp utilizatorul scrie;
  // valoarea se validează și se limitează la min/max abia la blur.
  const [amountStr, setAmountStr] = useState<string>(String(initAmount));
  const amountFocusedRef = useRef(false);
  const [monthsStr, setMonthsStr] = useState<string>(String(initMonths));
  const monthsFocusedRef = useRef(false);

  // ── Fetch limits from global settings ────────────────────────────
  const { data: settingsRaw } = useQuery<any[]>({
    queryKey: ['calculator-settings'],
    queryFn: () => api.get('/settings/calculator').then((r) => r.data.data),
  });

  const s = useMemo(() => {
    const map: Record<string, string> = {};
    (settingsRaw ?? []).forEach((row: any) => { map[row.key] = row.value; });
    return map;
  }, [settingsRaw]);

  const minAmount = creditType === 'ZERO'
    ? parseFloat(s['ZERO_MIN_AMOUNT']    ?? '500')
    : parseFloat(s['CLASSIC_MIN_AMOUNT'] ?? '1000');
  const maxAmount = creditType === 'ZERO'
    ? parseFloat(s['ZERO_MAX_AMOUNT']    ?? '10000')
    : parseFloat(s['CLASSIC_MAX_AMOUNT'] ?? '100000');
  const minMonths = creditType === 'ZERO'
    ? parseInt(s['ZERO_MIN_MONTHS']    ?? '3')
    : parseInt(s['CLASSIC_MIN_MONTHS'] ?? '3');
  const maxMonths = creditType === 'ZERO'
    ? parseInt(s['ZERO_MAX_MONTHS']    ?? '24')
    : parseInt(s['CLASSIC_MAX_MONTHS'] ?? '50');

  // Procentul dobânzii compensate pentru luna curentă (Credit Zero)
  const commissionPct = useMemo(() => {
    if (creditType !== 'ZERO') return 0;
    const tableRaw = s['ZERO_COMMISSION_TABLE'];
    if (!tableRaw) return 0;
    try {
      const table = JSON.parse(tableRaw) as Record<string, number>;
      return Number(table[String(months)] ?? 0);
    } catch { return 0; }
  }, [creditType, months, s]);

  // Tipurile de credit permise pentru acest partener
  const allowedCreditTypes = useMemo<CreditType[]>(() => {
    const raw = s['ALLOWED_CREDIT_TYPES'];
    if (!raw) return ['ZERO', 'CLASSIC'];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as string[]).filter((t): t is CreditType => t === 'ZERO' || t === 'CLASSIC');
      }
    } catch {}
    return (raw.split(',').map(t => t.trim()) as string[]).filter((t): t is CreditType => t === 'ZERO' || t === 'CLASSIC');
  }, [s]);

  const handleCreditTypeChange = (type: CreditType) => {
    setCreditType(type);
    setResult(null);
    const newMinAmt = type === 'ZERO' ? parseFloat(s['ZERO_MIN_AMOUNT']    ?? '500')    : parseFloat(s['CLASSIC_MIN_AMOUNT'] ?? '1000');
    const newMaxAmt = type === 'ZERO' ? parseFloat(s['ZERO_MAX_AMOUNT']    ?? '10000')  : parseFloat(s['CLASSIC_MAX_AMOUNT'] ?? '100000');
    const newMaxMon = type === 'ZERO' ? parseInt(s['ZERO_MAX_MONTHS']      ?? '24')     : parseInt(s['CLASSIC_MAX_MONTHS']   ?? '50');
    const newMinMon = type === 'ZERO' ? parseInt(s['ZERO_MIN_MONTHS']      ?? '3')      : parseInt(s['CLASSIC_MIN_MONTHS']   ?? '3');
    setAmount((prev) => Math.max(newMinAmt, Math.min(newMaxAmt, prev)));
    setMonths((prev) => Math.max(newMinMon, Math.min(newMaxMon, prev)));
  };

  // Sincronizează câmpul "Suma produsului" când se schimbă suma creditului sau comisionul
  useEffect(() => {
    if (!productFocusedRef.current) {
      const pa = Math.round(amount * (1 - commissionPct / 100) * 100) / 100;
      setProductAmountStr(String(pa));
    }
  }, [amount, commissionPct]);

  // Sincronizează câmpurile text cu starea numerică (slider, schimbare tip credit)
  useEffect(() => {
    if (!amountFocusedRef.current) setAmountStr(String(amount));
  }, [amount]);
  useEffect(() => {
    if (!monthsFocusedRef.current) setMonthsStr(String(months));
  }, [months]);

  // Auto-selectează tipul permis dacă cel curent nu e în lista permisă
  useEffect(() => {
    if (allowedCreditTypes.length > 0 && !allowedCreditTypes.includes(creditType)) {
      handleCreditTypeChange(allowedCreditTypes[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCreditTypes]);

  const calculate = async () => {
    if (amount < minAmount || amount > maxAmount) {
      toast({ title: 'Sumă invalidă', description: `Suma trebuie să fie între ${minAmount} și ${maxAmount} MDL`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/calculator/calculate', { creditType, amount, months });
      setResult(res.data.data);
    } catch (err: any) {
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Eroare la calcul', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      const res = await api.post('/reports/amortization-pdf', { creditType, amount, months }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ionix-grafic-rambursare-${amount}-${months}luni.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Eroare PDF', description: 'Nu s-a putut genera PDF-ul', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Header
        title="Calculator Credit"
        subtitle={`Partener: ${user?.partner?.companyName ?? 'Bug Fix Group'}`}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Controls ──────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Credit type selector */}
          <div className="glass-card p-5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Tip Credit</p>
            <div className="grid grid-cols-2 gap-2">
              {(['ZERO', 'CLASSIC'] as const).filter(type => allowedCreditTypes.includes(type)).map((type) => (
                <motion.button
                  key={type}
                  onClick={() => handleCreditTypeChange(type)}
                  className={`relative rounded-lg p-4 text-left border transition-all duration-200 ${
                    creditType === type
                      ? 'border-brand-500/50 bg-brand-500/12'
                      : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/6'
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className={`w-2 h-2 rounded-full mb-2 ${type === 'ZERO' ? 'bg-green-400' : 'bg-blue-400'}`} />
                  <div className="text-sm font-semibold text-white">Credit {type === 'ZERO' ? 'Zero' : 'Clasic'}</div>
                  <div className="text-xs text-white/40 mt-0.5">
                    {type === 'ZERO' ? '0% dobândă' : 'Rată anuitate'}
                  </div>
                  {creditType === type && (
                    <motion.div layoutId="type-indicator" className="absolute inset-0 rounded-lg border border-brand-500/40 pointer-events-none" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="glass-card p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Suma creditului</label>
                <span className="text-sm font-bold text-brand-400">{formatMDL(amount)}</span>
              </div>
              <input
                type="range"
                min={minAmount}
                max={maxAmount}
                step={500}
                value={amount}
                onChange={(e) => { setAmount(Number(e.target.value)); setResult(null); }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #22DB80 ${((amount - minAmount) / (maxAmount - minAmount)) * 100}%, rgba(255,255,255,0.1) 0%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-white/25">{formatMDL(minAmount)}</span>
                <span className="text-xs text-white/25">{formatMDL(maxAmount)}</span>
              </div>
              <input
                type="number"
                value={amountStr}
                min={minAmount}
                max={maxAmount}
                onFocus={() => { amountFocusedRef.current = true; }}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmountStr(val);
                  const num = Number(val);
                  if (val !== '' && !isNaN(num)) { setAmount(num); setResult(null); }
                }}
                onBlur={() => {
                  amountFocusedRef.current = false;
                  const num = Number(amountStr);
                  const clamped = amountStr === '' || isNaN(num)
                    ? Math.max(minAmount, Math.min(maxAmount, amount))
                    : Math.max(minAmount, Math.min(maxAmount, num));
                  setAmount(clamped);
                  setAmountStr(String(clamped));
                }}
                className="ionix-input mt-3 font-mono text-center text-lg"
              />

              {/* Suma produsului — doar pentru Credit Zero */}
              {creditType === 'ZERO' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Suma produsului</label>
                    {commissionPct > 0 && (
                      <span className="text-[10px] text-white/25">dobândă compensată {commissionPct}%</span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={productAmountStr}
                    min={Math.round(minAmount * (1 - commissionPct / 100) * 100) / 100}
                    max={Math.round(maxAmount * (1 - commissionPct / 100) * 100) / 100}
                    onFocus={() => { productFocusedRef.current = true; }}
                    onBlur={() => {
                      productFocusedRef.current = false;
                      const num = parseFloat(productAmountStr);
                      if (!isNaN(num) && commissionPct < 100) {
                        const factor = 1 - commissionPct / 100;
                        const newAmt = Math.round(num / factor);
                        const clamped = Math.max(minAmount, Math.min(maxAmount, newAmt));
                        setAmount(clamped);
                        setResult(null);
                        const pa = Math.round(clamped * (1 - commissionPct / 100) * 100) / 100;
                        setProductAmountStr(String(pa));
                      } else {
                        // Câmp gol sau invalid — restaurează valoarea calculată
                        const pa = Math.round(amount * (1 - commissionPct / 100) * 100) / 100;
                        setProductAmountStr(String(pa));
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProductAmountStr(val);
                      const num = parseFloat(val);
                      if (!isNaN(num) && commissionPct < 100) {
                        const factor = 1 - commissionPct / 100;
                        const newAmt = Math.round(num / factor);
                        const clamped = Math.max(minAmount, Math.min(maxAmount, newAmt));
                        setAmount(clamped);
                        setResult(null);
                      }
                    }}
                    className="ionix-input font-mono text-center text-lg"
                  />
                </div>
              )}
            </div>

            {/* Months */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Termen (luni)</label>
                <span className="text-sm font-bold text-brand-400">{months} luni</span>
              </div>
              <input
                type="range"
                min={minMonths}
                max={maxMonths}
                step={1}
                value={months}
                onChange={(e) => { setMonths(Number(e.target.value)); setResult(null); }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #22DB80 ${((months - minMonths) / (maxMonths - minMonths)) * 100}%, rgba(255,255,255,0.1) 0%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-white/25">{minMonths} luni</span>
                <span className="text-xs text-white/25">{maxMonths} luni</span>
              </div>
              <input
                type="number"
                value={monthsStr}
                min={minMonths}
                max={maxMonths}
                onFocus={() => { monthsFocusedRef.current = true; }}
                onChange={(e) => {
                  const val = e.target.value;
                  setMonthsStr(val);
                  const num = parseInt(val, 10);
                  if (val !== '' && !isNaN(num)) { setMonths(num); setResult(null); }
                }}
                onBlur={() => {
                  monthsFocusedRef.current = false;
                  const num = parseInt(monthsStr, 10);
                  const clamped = monthsStr === '' || isNaN(num)
                    ? Math.max(minMonths, Math.min(maxMonths, months))
                    : Math.max(minMonths, Math.min(maxMonths, num));
                  setMonths(clamped);
                  setMonthsStr(String(clamped));
                }}
                className="ionix-input mt-3 font-mono text-center text-lg"
              />
            </div>

            {/* Calculate button */}
            <motion.button
              onClick={calculate}
              disabled={loading}
              className="btn-primary w-full h-11 text-base"
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Se calculează...</>
              ) : (
                <><Calculator className="w-4 h-4" /> Calculează</>
              )}
            </motion.button>
          </div>
        </div>

        {/* ── Results ───────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-5">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="space-y-5"
              >
                {/* Key metrics */}
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-white">Rezultat calcul</h2>
                    <span className={`badge text-xs ${result.creditType === 'ZERO' ? 'badge-green' : 'badge-blue'}`}>
                      Credit {result.creditType === 'ZERO' ? 'Zero' : 'Clasic'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl p-4 bg-brand-500/10 border border-brand-500/20 text-center">
                      <p className="text-xs text-white/40 mb-1">Rată lunară</p>
                      <motion.p
                        key={result.monthlyPayment}
                        className="text-2xl font-bold text-brand-400"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        {formatMDL(result.monthlyPayment)}
                      </motion.p>
                      <p className="text-xs text-white/30 mt-0.5">MDL / lună</p>
                    </div>
                    <div className="rounded-xl p-4 bg-white/5 border border-white/8 text-center">
                      <p className="text-xs text-white/40 mb-1">Total de plată (VTP)</p>
                      <motion.p
                        key={result.totalAmount}
                        className="text-2xl font-bold text-white"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.05 }}
                      >
                        {formatMDL(result.totalAmount)}
                      </motion.p>
                      <p className="text-xs text-white/30 mt-0.5">MDL total</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {(result.creditType === 'ZERO'
                      ? (() => {
                          const commissionPct = result.amount > 0
                            ? Math.round((result.zeroCommission ?? 0) / result.amount * 10000) / 100
                            : 0;
                          return [
                            { label: 'DAE',               value: '0%' },
                            { label: 'Dobândă totală',     value: formatMDL(0) },
                            { label: 'Dobândă Compensată', value: `${commissionPct}% (${formatMDL(result.zeroCommission ?? 0)})` },
                          ];
                        })()
                      : [
                          { label: 'DAE',                  value: `${result.dae}%` },
                          { label: 'Dobândă totală',        value: formatMDL(result.totalInterest) },
                          { label: 'Comision administrare', value: formatMDL(result.processingFee) },
                        ]
                    ).map(({ label, value }) => (
                      <div key={label} className="rounded-lg p-3 bg-white/4 border border-white/8 text-center">
                        <p className="text-xs text-white/35">{label}</p>
                        <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-4">
                    <button onClick={downloadPdf} disabled={pdfLoading} className="btn-ghost flex-1 border border-white/10 hover:border-brand-500/30">
                      {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Descarcă PDF
                    </button>
                    <a
                      href={`/applications/new?amount=${result.amount}&months=${result.months}&creditType=${result.creditType}`}
                      className="btn-primary flex-1"
                    >
                      <Send className="w-4 h-4" />
                      Depune Cerere
                    </a>
                  </div>
                </div>

                {/* Amortization table */}
                <div className="glass-card p-5">
                  <h2 className="text-sm font-semibold text-white mb-4">Grafic de Rambursare</h2>
                  <AmortizationTable schedule={result.schedule} creditType={result.creditType} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-10 flex flex-col items-center justify-center text-center h-64"
              >
                <Calculator className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-white/40 text-sm">Introduceți parametrii și apăsați <strong className="text-white/60">Calculează</strong></p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <Suspense>
      <CalculatorInner />
    </Suspense>
  );
}
