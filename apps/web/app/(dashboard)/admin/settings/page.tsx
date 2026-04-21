'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Save, Loader2, Settings, AlertTriangle, Percent } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface SettingRow {
  key: string;
  value: string;
  type: string;
  label?: string;
  description?: string;
}

// ── Editor vizual pentru tabelul de dobânzi compensate Credit ZERO ──
function ZeroCommissionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = useMemo(() => {
    try { return JSON.parse(value) as Record<string, number>; }
    catch { return {} as Record<string, number>; }
  }, [value]);

  const handleChange = (month: number, raw: string) => {
    const pct = parseFloat(raw);
    const updated = { ...parsed, [String(month)]: isNaN(pct) ? 0 : pct };
    onChange(JSON.stringify(updated));
  };

  const months = Array.from({ length: 22 }, (_, i) => i + 3); // 3–24

  return (
    <div className="w-full mt-1">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        {months.map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-white/40 w-7 text-right shrink-0">
              {m}L
            </span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={parsed[String(m)] ?? 0}
              onChange={(e) => handleChange(m, e.target.value)}
              className="ionix-input font-mono text-xs py-1.5 text-center flex-1 min-w-0"
            />
            <span className="text-xs text-white/30">%</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/20 mt-2 font-mono">
        ZERO_COMMISSION_TABLE — {months.length} intrări (luni 3–24)
      </p>
    </div>
  );
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
  });

  const { mutate: saveAll, isPending } = useMutation({
    mutationFn: () =>
      api.put('/settings', {
        settings: Object.entries(edits).map(([key, value]) => ({ key, value })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setEdits({});
      toast({ title: 'Salvat!', description: 'Setările au fost actualizate cu succes.' });
    },
    onError: () => toast({ title: 'Eroare', description: 'Nu s-au putut salva setările', variant: 'destructive' }),
  });

  const getValue = (key: string, fallback: string) => edits[key] ?? fallback;
  const handleChange = (key: string, value: string) => setEdits((p) => ({ ...p, [key]: value }));

  const EXCLUDED_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_ENABLED'];
  const allSettings: SettingRow[] = (settings ?? []).filter(
    (s: SettingRow) => !EXCLUDED_KEYS.includes(s.key),
  );

  // Separate the commission table from the other settings
  const commissionSetting = allSettings.find((s) => s.key === 'ZERO_COMMISSION_TABLE');
  const otherSettings     = allSettings.filter((s) => s.key !== 'ZERO_COMMISSION_TABLE');

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header title="Setări Globale" subtitle="Modificați parametrii calculatorului fără a edita codul" />

      {isLoading ? (
        <div className="glass-card p-6 space-y-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-white/10 rounded flex-1" />
              <div className="h-8 bg-white/10 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Unsaved changes banner ──────────────────────────── */}
          {Object.keys(edits).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-yellow-500/8 border border-yellow-500/20"
            >
              <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                {Object.keys(edits).length} modificare(i) nesalvate
              </span>
              <button onClick={() => saveAll()} disabled={isPending} className="btn-primary py-1.5 px-3 text-xs">
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Salvează tot
              </button>
            </motion.div>
          )}

          {/* ── Parametri Calculator (numeric + boolean) ─────────── */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Parametri Calculator</h2>
            </div>
            <div className="space-y-1">
              {otherSettings.map((s: SettingRow) => (
                <motion.div
                  key={s.key}
                  className={`flex items-center justify-between gap-4 py-3 px-4 rounded-lg transition-colors ${
                    edits[s.key] !== undefined
                      ? 'bg-yellow-500/5 border border-yellow-500/15'
                      : 'hover:bg-white/3'
                  }`}
                  layout
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.label ?? s.key}</p>
                    {s.description && <p className="text-xs text-white/35 mt-0.5">{s.description}</p>}
                    <p className="text-[10px] text-white/20 font-mono mt-0.5">{s.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.type === 'boolean' ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleChange(s.key, getValue(s.key, s.value) === 'true' ? 'false' : 'true')
                        }
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          getValue(s.key, s.value) === 'true' ? 'bg-brand-500' : 'bg-white/15'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            getValue(s.key, s.value) === 'true' ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <input
                        type={s.type === 'number' ? 'number' : 'text'}
                        value={getValue(s.key, s.value)}
                        onChange={(e) => handleChange(s.key, e.target.value)}
                        step={s.type === 'number' ? '0.0001' : undefined}
                        className="ionix-input font-mono text-sm py-1.5 w-32 text-right"
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Tabel Dobândă Compensată Credit ZERO ─────────────── */}
          {commissionSetting && (
            <motion.div
              className={`glass-card p-6 ${
                edits['ZERO_COMMISSION_TABLE'] !== undefined
                  ? 'border border-yellow-500/20 bg-yellow-500/3'
                  : ''
              }`}
              layout
            >
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4 text-brand-400" />
                <h2 className="text-sm font-semibold text-white">
                  {commissionSetting.label ?? 'Dobândă Compensată Credit Zero'}
                </h2>
                {edits['ZERO_COMMISSION_TABLE'] !== undefined && (
                  <span className="ml-auto text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Modificat
                  </span>
                )}
              </div>
              {commissionSetting.description && (
                <p className="text-xs text-white/35 mb-4">{commissionSetting.description}</p>
              )}
              <ZeroCommissionEditor
                value={getValue('ZERO_COMMISSION_TABLE', commissionSetting.value)}
                onChange={(v) => handleChange('ZERO_COMMISSION_TABLE', v)}
              />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
