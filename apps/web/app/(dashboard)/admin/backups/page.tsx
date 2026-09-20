'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Database, Download, Trash2, RefreshCw, Loader2, HardDrive, FileArchive, AlertTriangle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Copie {
  name: string;
  size: number;
  createdAt: string;
  fel: 'baza' | 'documente' | 'altele';
}

const marime = (o: number) =>
  o >= 1048576 ? `${(o / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(o / 1024))} KB`;

const cand = (s: string) =>
  new Date(s).toLocaleString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** Ultima copie din fiecare fel — ca să se vadă dintr-o privire dacă s-a oprit ceva. */
function Panou({ titlu, icon: Icon, copie }: { titlu: string; icon: any; copie?: Copie }) {
  const azi = copie && new Date(copie.createdAt).toDateString() === new Date().toDateString();
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-brand-400" />
        <span className="text-[11px] uppercase tracking-wide text-white/40">{titlu}</span>
      </div>
      {copie ? (
        <>
          <div className="text-lg font-semibold text-white">
            {new Date(copie.createdAt).toLocaleDateString('ro-RO')}
          </div>
          <div className={`text-xs ${azi ? 'text-brand-400' : 'text-yellow-400'}`}>
            {azi ? 'de azi' : 'nu e de azi'} · {marime(copie.size)}
          </div>
        </>
      ) : (
        <div className="text-sm text-yellow-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> nicio copie
        </div>
      )}
    </div>
  );
}

export default function BackupsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [seLucreaza, setSeLucreaza] = useState<string | null>(null);

  const { data: copii = [], isLoading } = useQuery<Copie[]>({
    queryKey: ['backups'],
    queryFn: async () => (await api.get('/backups')).data?.data ?? [],
  });

  const { data: cfg } = useQuery({
    queryKey: ['backups-config'],
    queryFn: async () => (await api.get('/backups/config')).data?.data ?? null,
  });

  const { mutate: faAcum, isPending } = useMutation({
    mutationFn: async () => (await api.post('/backups/run')).data,
    onSuccess: () => {
      toast({ title: 'Copie făcută', description: 'Baza şi documentele au fost salvate.' });
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (e: any) =>
      toast({
        title: 'Copia nu a reuşit',
        description: e?.response?.data?.message ?? 'Încearcă din nou.',
        variant: 'destructive',
      }),
  });

  /**
   * Descărcarea trece prin `api`, ca să poarte jetonul de autentificare — o
   * legătură simplă ar primi 401. Fişierul vine ca flux şi poate fi mare, deci
   * îl luăm ca `blob` şi îl dăm browserului.
   */
  async function descarca(c: Copie) {
    setSeLucreaza(c.name);
    try {
      const r = await api.get(`/backups/${encodeURIComponent(c.name)}/download`, {
        responseType: 'blob',
        timeout: 300_000,
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/gzip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = c.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast({ title: 'Descărcarea nu a reuşit', variant: 'destructive' });
    } finally {
      setSeLucreaza(null);
    }
  }

  const { mutate: sterge } = useMutation({
    mutationFn: async (name: string) => (await api.delete(`/backups/${encodeURIComponent(name)}`)).data,
    onSuccess: () => {
      toast({ title: 'Copie ştearsă' });
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const ultima = (fel: Copie['fel']) => copii.find((c) => c.fel === fel);

  return (
    <>
      <Header title="Copii de rezervă" subtitle="Baza de date şi actele, salvate zilnic pe NAS" />

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
            Baza de date şi actele clienţilor, zilnic la <strong className="text-white/70">03:00</strong>{' '}
            (ora Chişinăului). Copiile bazei se păstrează{' '}
            <strong className="text-white/70">{cfg?.retentionDays ?? 14} zile</strong>, iar arhivele cu
            acte — ultimele <strong className="text-white/70">{cfg?.arhiveDePastrat ?? 7}</strong>.
            {cfg?.dir && <> Locaţie: <code className="text-white/60">{cfg.dir}</code></>}
          </p>
          <button onClick={() => faAcum()} disabled={isPending} className="btn-primary py-2 px-4 text-xs shrink-0">
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Creează copie acum
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panou titlu="Baza de date" icon={Database} copie={ultima('baza')} />
          <Panou titlu="Acte clienţi" icon={FileArchive} copie={ultima('documente')} />
        </div>

        <div className="glass-card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Se încarcă…
            </div>
          ) : copii.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nicio copie încă. Prima se face automat la 03:00.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-white/40 border-b border-white/5">
                  <th className="text-left font-medium px-4 py-3">Fişier</th>
                  <th className="text-left font-medium px-4 py-3">Mărime</th>
                  <th className="text-left font-medium px-4 py-3">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {copii.map((c) => (
                  <motion.tr
                    key={c.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/3"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white/80">
                      {c.name}
                      {c.fel === 'documente' && (
                        <span className="ml-2 badge badge-blue text-[10px]">acte</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 tabular-nums">{marime(c.size)}</td>
                    <td className="px-4 py-3 text-white/50 tabular-nums">{cand(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => descarca(c)}
                          disabled={seLucreaza === c.name}
                          title="Descarcă"
                          className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-brand-400 transition-colors"
                        >
                          {seLucreaza === c.name
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Ştergi copia ${c.name}?\n\nNu se mai poate întoarce.`)) sterge(c.name);
                          }}
                          title="Şterge"
                          className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-[11px] text-white/30 flex items-start gap-1.5">
          <HardDrive className="w-3.5 h-3.5 shrink-0 mt-px" />
          Copiile stau pe acelaşi NAS cu sistemul. O copie pe alt disc, ţinută în altă parte, e
          singura care ajută dacă se strică NAS-ul — descarc-o de aici din când în când.
        </p>
      </div>
    </>
  );
}
