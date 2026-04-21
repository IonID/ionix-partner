'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Eye, CheckCircle, Clock, XCircle,
  ChevronDown, Download, Trash2, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { formatMDL, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

type AppStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

const statusConfig: Record<AppStatus, { label: string; badge: string; icon: any }> = {
  PENDING:    { label: 'În așteptare',  badge: 'badge-yellow', icon: Clock },
  PROCESSING: { label: 'În procesare', badge: 'badge-blue',   icon: Clock },
  APPROVED:   { label: 'Aprobat',      badge: 'badge-green',  icon: CheckCircle },
  REJECTED:   { label: 'Respins',      badge: 'badge-red',    icon: XCircle },
  CANCELLED:  { label: 'Anulat',       badge: 'badge-gray',   icon: XCircle },
};

const ALL_STATUSES = Object.keys(statusConfig) as AppStatus[];

const STATUS_OPTIONS: { value: AppStatus | ''; label: string }[] = [
  { value: '',           label: 'Toate statusurile' },
  { value: 'PENDING',    label: 'În așteptare' },
  { value: 'PROCESSING', label: 'În procesare' },
  { value: 'APPROVED',   label: 'Aprobate' },
  { value: 'REJECTED',   label: 'Respinse' },
  { value: 'CANCELLED',  label: 'Anulate' },
];

// ── Quick status dropdown per row (admin only) ────────────────────
function QuickStatusSelect({ appId, currentStatus }: { appId: string; currentStatus: AppStatus }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: (status: AppStatus) =>
      api.patch(`/applications/${appId}/status`, { status }),
    onMutate: async (status) => {
      // Optimistic update across all cached pages
      qc.setQueriesData<any>({ queryKey: ['applications'] }, (old) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((a: any) => a.id === appId ? { ...a, status } : a) };
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['application', appId] });
    },
    onError: (err: any) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' });
    },
  });

  const sc = statusConfig[currentStatus];

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={isPending}
        className={`badge text-xs ${sc.badge} flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {sc.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop */}
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="absolute left-0 mt-1 w-44 rounded-xl border border-white/12 bg-[#13151f] shadow-xl z-30 overflow-hidden"
            >
              {ALL_STATUSES.filter((s) => s !== currentStatus).map((s) => (
                <button
                  key={s}
                  onClick={() => { mutate(s); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/8 transition-colors text-white/70"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    s === 'PENDING'    ? 'bg-yellow-400' :
                    s === 'PROCESSING' ? 'bg-blue-400'   :
                    s === 'APPROVED'   ? 'bg-green-400'  :
                    s === 'REJECTED'   ? 'bg-red-400'    : 'bg-white/30'
                  }`} />
                  {statusConfig[s].label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatus | ''>('');
  const [page, setPage] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await api.get('/applications/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `cereri-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export reușit', description: 'Fișierul Excel a fost descărcat.' });
    } catch {
      toast({ title: 'Eroare export', description: 'Nu s-a putut genera exportul.', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const { mutate: deleteAll, isPending: deleteAllLoading } = useMutation({
    mutationFn: () => api.delete('/applications'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      setShowDeleteAllModal(false);
      toast({ title: 'Listă golită', description: `${res.data?.data?.deleted ?? 0} cereri au fost șterse.` });
    },
    onError: () => toast({ title: 'Eroare', description: 'Nu s-au putut șterge cererile.', variant: 'destructive' }),
  });

  const { mutate: deleteOne, isPending: deleteOneLoading } = useMutation({
    mutationFn: (id: string) => api.delete(`/applications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      setDeleteTarget(null);
      toast({ title: 'Cerere ștearsă', description: 'Cererea a fost eliminată permanent.' });
    },
    onError: () => toast({ title: 'Eroare', description: 'Nu s-a putut șterge cererea.', variant: 'destructive' }),
  });

  const queryParams = new URLSearchParams({ page: String(page), limit: '20' });
  if (statusFilter) queryParams.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page, statusFilter],
    queryFn: () => api.get(`/applications?${queryParams}`).then((r) => r.data.data),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const apps = data?.data ?? [];
  const filtered = apps.filter((a: any) =>
    search === '' ||
    `${a.clientFirstName} ${a.clientLastName}`.toLowerCase().includes(search.toLowerCase()) ||
    a.clientIdnp?.includes(search),
  );

  const handleStatusSelect = (v: AppStatus | '') => {
    setStatusFilter(v);
    setPage(1);
    setDropdownOpen(false);
  };

  const activeStatusLabel = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'Toate';

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header
        title="Cereri de Credit"
        subtitle={user?.role === 'ADMIN' ? 'Toate cererile' : 'Cererile tale'}
      />

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută după nume sau IDNP..."
            className="ionix-input pl-9"
          />
        </div>

        {/* Status filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`ionix-input flex items-center gap-2 pr-3 pl-4 cursor-pointer whitespace-nowrap transition-colors ${
              statusFilter ? 'border-brand-500/40 text-brand-400' : 'text-white/60'
            }`}
          >
            <span className="text-sm">{activeStatusLabel}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-1 w-48 rounded-xl border border-white/12 bg-[#13151f] shadow-xl z-20 overflow-hidden"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusSelect(opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors hover:bg-white/8 ${
                      statusFilter === opt.value ? 'text-brand-400 bg-brand-500/8' : 'text-white/70'
                    }`}
                  >
                    {opt.value ? (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        opt.value === 'PENDING'    ? 'bg-yellow-400' :
                        opt.value === 'PROCESSING' ? 'bg-blue-400'   :
                        opt.value === 'APPROVED'   ? 'bg-green-400'  :
                        opt.value === 'REJECTED'   ? 'bg-red-400'    : 'bg-white/30'
                      }`} />
                    ) : (
                      <span className="w-2 h-2 rounded-full flex-shrink-0 border border-white/20" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link href="/applications/new" className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Cerere Nouă
        </Link>

        {user?.role === 'ADMIN' && (
          <>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="btn-ghost whitespace-nowrap border border-white/10 hover:border-brand-500/30"
            >
              <Download className="w-4 h-4" />
              {exportLoading ? 'Se exportă...' : 'Export Excel'}
            </button>

            <button
              onClick={() => setShowDeleteAllModal(true)}
              className="btn-ghost whitespace-nowrap border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60"
            >
              <Trash2 className="w-4 h-4" />
              Golire Listă
            </button>
          </>
        )}
      </div>

      {/* ── Modal confirmare ștergere TOATE ────────────────────── */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <motion.div
            key="delete-all-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteAllModal(false)}
          >
            <motion.div
              key="delete-all-modal"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Golire completă a listei</h3>
                  <p className="text-sm text-white/50">
                    Această acțiune va șterge <span className="text-red-400 font-medium">permanent</span> toate
                    cererile de credit din baza de date, inclusiv documentele atașate. Acțiunea nu poate fi anulată.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowDeleteAllModal(false)} className="btn-ghost border border-white/10" disabled={deleteAllLoading}>
                  Anulează
                </button>
                <button
                  onClick={() => deleteAll()}
                  disabled={deleteAllLoading}
                  className="btn-ghost border border-red-500/40 text-red-400 hover:bg-red-500/15 hover:border-red-500/70 font-semibold"
                >
                  {deleteAllLoading ? 'Se șterge...' : 'Da, șterge tot'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal confirmare ștergere O cerere ─────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            key="delete-one-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              key="delete-one-modal"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">Șterge cererea</h3>
                  <p className="text-sm text-white/50">
                    Cererea lui <span className="text-white font-medium">{deleteTarget.name}</span> va fi
                    ștearsă <span className="text-red-400 font-medium">permanent</span>, inclusiv documentele atașate.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteTarget(null)} className="btn-ghost border border-white/10" disabled={deleteOneLoading}>
                  Anulează
                </button>
                <button
                  onClick={() => deleteOne(deleteTarget.id)}
                  disabled={deleteOneLoading}
                  className="btn-ghost border border-red-500/40 text-red-400 hover:bg-red-500/15 hover:border-red-500/70 font-semibold"
                >
                  {deleteOneLoading ? 'Se șterge...' : 'Da, șterge'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter chip ───────────────────────────────── */}
      {statusFilter && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <span className="text-xs text-white/40">Filtru activ:</span>
          <span className={`badge text-xs ${statusConfig[statusFilter].badge} flex items-center gap-1`}>
            {statusConfig[statusFilter].label}
            <button onClick={() => handleStatusSelect('')} className="ml-1 opacity-60 hover:opacity-100 text-base leading-none">×</button>
          </span>
          {data && <span className="text-xs text-white/30">{data.total} rezultate</span>}
        </motion.div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden" onClick={() => dropdownOpen && setDropdownOpen(false)}>
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 animate-pulse">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-4 bg-white/8 rounded flex-1" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ionix-table">
              <thead>
                <tr>
                  <th>Client</th>
                  {user?.role === 'ADMIN' && <th>Partener</th>}
                  <th>Tip Credit</th>
                  <th>Sumă</th>
                  <th>Termen</th>
                  <th>Rată / lună</th>
                  <th>Status</th>
                  <th>Depus de</th>
                  <th>Modificat de</th>
                  <th>Data cererii</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app: any, i: number) => {
                  const sc = statusConfig[app.status as AppStatus];
                  return (
                    <motion.tr
                      key={app.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td>
                        <div className="font-medium text-white">{app.clientFirstName} {app.clientLastName}</div>
                        <div className="text-xs text-white/35 font-mono">{app.clientIdnp}</div>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="text-white/60 text-xs">{app.partner?.companyName}</td>
                      )}
                      <td>
                        <span className={`badge text-xs ${app.creditType === 'ZERO' ? 'badge-green' : 'badge-blue'}`}>
                          {app.creditType === 'ZERO' ? 'Zero' : 'Clasic'}
                        </span>
                      </td>
                      <td className="font-mono text-white/80">{formatMDL(app.amount)}</td>
                      <td className="text-white/60">{app.months} luni</td>
                      <td className="font-mono text-brand-400">{formatMDL(app.monthlyPayment)}</td>
                      <td>
                        {user?.role === 'ADMIN' ? (
                          <QuickStatusSelect appId={app.id} currentStatus={app.status as AppStatus} />
                        ) : (
                          sc && <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                        )}
                      </td>
                      <td className="text-white/50 text-xs">
                        {app.createdByUser
                          ? `${app.createdByUser.firstName} ${app.createdByUser.lastName}`
                          : <span className="text-white/20">—</span>}
                      </td>
                      <td className="text-white/50 text-xs">
                        {app.statusChangedByName ?? <span className="text-white/20">—</span>}
                      </td>
                      <td className="text-white/40 text-xs">{formatDate(app.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/applications/${app.id}`} className="btn-ghost px-2 py-1.5">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => setDeleteTarget({
                                id: app.id,
                                name: `${app.clientFirstName} ${app.clientLastName}`,
                              })}
                              className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
                              title="Șterge cererea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-white/30">
                      {search ? 'Niciun rezultat pentru căutare' : statusFilter ? `Nicio cerere cu statusul "${statusConfig[statusFilter]?.label}"` : 'Nu există cereri încă'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/8">
            <span className="text-xs text-white/40">{data.total} cereri totale</span>
            <div className="flex gap-2">
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40' : 'text-white/40 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
