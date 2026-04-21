'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatMDL } from '@/lib/utils';

interface Row {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

function paymentDate(monthIndex: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthIndex, now.getDate());
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function AmortizationTable({ schedule }: { schedule: Row[] }) {
  const rows = useMemo(() =>
    schedule.map((row, i) => ({
      ...row,
      date:       paymentDate(i + 1),
      commission: Math.max(0, Math.round((row.payment - row.principal - row.interest) * 100) / 100),
    })),
    [schedule],
  );

  const totalPrincipal   = rows.reduce((s, r) => s + r.principal, 0);
  const totalCommission  = rows.reduce((s, r) => s + r.commission, 0);
  const totalPayment     = rows.reduce((s, r) => s + r.payment, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-left">#</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-left">Data</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-right">Principal</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-right">Comision</th>
            <th className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-right">Total Lunar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={row.month}
              className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.25 }}
            >
              <td className="py-2.5 px-3">
                <span className="w-7 h-7 rounded-full bg-brand-500/10 border border-brand-500/20 inline-flex items-center justify-center text-xs text-brand-400 font-bold">
                  {row.month}
                </span>
              </td>
              <td className="py-2.5 px-3 font-mono text-white/50 text-xs">
                {row.date}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-white/80">
                {formatMDL(row.principal)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${row.commission > 0 ? 'text-orange-400/80' : 'text-white/30'}`}>
                {row.commission > 0 ? formatMDL(row.commission) : '—'}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-brand-400 font-semibold">
                {formatMDL(row.payment)}
              </td>
            </motion.tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/15 bg-white/3">
            <td colSpan={2} className="py-3 px-3 text-xs font-bold text-white/50 uppercase">Total</td>
            <td className="py-3 px-3 text-right font-mono font-bold text-white/70">
              {formatMDL(totalPrincipal)}
            </td>
            <td className="py-3 px-3 text-right font-mono font-bold text-orange-400/70">
              {formatMDL(totalCommission)}
            </td>
            <td className="py-3 px-3 text-right font-mono font-bold text-brand-400">
              {formatMDL(totalPayment)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
