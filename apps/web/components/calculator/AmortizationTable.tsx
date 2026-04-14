'use client';

import { motion } from 'framer-motion';
import { formatMDL } from '@/lib/utils';

interface Row {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export function AmortizationTable({ schedule }: { schedule: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {['Luna', 'Rată Lunară', 'Principal', 'Dobândă', 'Sold Rămas'].map((h) => (
              <th key={h} className="py-2.5 px-3 text-xs font-semibold text-white/35 uppercase tracking-wider text-right first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, i) => (
            <motion.tr
              key={row.month}
              className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.25 }}
            >
              <td className="py-2.5 px-3 font-medium text-white">
                <span className="w-7 h-7 rounded-full bg-brand-500/10 border border-brand-500/20 inline-flex items-center justify-center text-xs text-brand-400 font-bold">
                  {row.month}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-brand-400 font-semibold">
                {formatMDL(row.payment)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-white/80">
                {formatMDL(row.principal)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${row.interest > 0 ? 'text-orange-400/80' : 'text-white/30'}`}>
                {row.interest > 0 ? formatMDL(row.interest) : '—'}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-white/60">
                {row.balance > 0 ? formatMDL(row.balance) : (
                  <span className="badge-green badge text-xs">Achitat</span>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot>
          <tr className="border-t border-white/15 bg-white/3">
            <td className="py-3 px-3 text-xs font-bold text-white/50 uppercase">Total</td>
            <td className="py-3 px-3 text-right font-mono font-bold text-brand-400">
              {formatMDL(schedule.reduce((s, r) => s + r.payment, 0))}
            </td>
            <td className="py-3 px-3 text-right font-mono font-bold text-white/70">
              {formatMDL(schedule.reduce((s, r) => s + r.principal, 0))}
            </td>
            <td className="py-3 px-3 text-right font-mono font-bold text-orange-400/70">
              {formatMDL(schedule.reduce((s, r) => s + r.interest, 0))}
            </td>
            <td className="py-3 px-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
