'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Save, Loader2, Settings, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

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

  const handleChange = (key: string, value: string) => {
    setEdits((p) => ({ ...p, [key]: value }));
  };

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
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Parametri calculator</h2>
            </div>
            {Object.keys(edits).length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  {Object.keys(edits).length} modificare(i) nesalvate
                </span>
                <button onClick={() => saveAll()} disabled={isPending} className="btn-primary py-1.5 px-3 text-xs">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvează
                </button>
              </motion.div>
            )}
          </div>

          <div className="space-y-1">
            {(settings ?? []).map((s: any) => (
              <motion.div
                key={s.key}
                className={`flex items-center justify-between gap-4 py-3 px-4 rounded-lg transition-colors ${edits[s.key] !== undefined ? 'bg-yellow-500/5 border border-yellow-500/15' : 'hover:bg-white/3'}`}
                layout
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.label ?? s.key}</p>
                  {s.description && <p className="text-xs text-white/35 mt-0.5 truncate">{s.description}</p>}
                  <p className="text-[10px] text-white/20 font-mono mt-0.5">{s.key}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.type === 'boolean' ? (
                    <button
                      type="button"
                      onClick={() => handleChange(s.key, getValue(s.key, s.value) === 'true' ? 'false' : 'true')}
                      className={`relative w-10 h-5 rounded-full transition-colors ${getValue(s.key, s.value) === 'true' ? 'bg-brand-500' : 'bg-white/15'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${getValue(s.key, s.value) === 'true' ? 'translate-x-5' : ''}`} />
                    </button>
                  ) : (
                    <input
                      type={s.type === 'number' ? 'number' : 'text'}
                      value={getValue(s.key, s.value)}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      step={s.type === 'number' ? '0.0001' : undefined}
                      className="ionix-input w-32 text-right font-mono text-sm py-1.5"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
