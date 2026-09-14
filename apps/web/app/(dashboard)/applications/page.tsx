'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, CheckCircle, Clock, XCircle,
  ChevronDown, Download, Trash2, AlertTriangle, SlidersHorizontal, X, Calendar,
  PenLine, Send,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

const DATE_PRESETS = [
  { value: 'today',   label: 'Azi' },
  { value: 'week',    label: 'Săpt. Curentă' },
  { value: 'month',   label: 'Luna Curentă' },
  { value: '3months', label: 'Ultimele 3 Luni' },
  { value: 'custom',  label: 'Perioada' },
];

function getPresetDates(preset: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = fmt(today);
  switch (preset) {
    case 'today':   return { from: todayStr, to: todayStr };
    case 'week': {
      const d = new Date(today);
      d.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return { from: fmt(d), to: todayStr };
    }
    case 'month':
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayStr };
    case '3months': {
      const d = new Date(today);
      d.setMonth(today.getMonth() - 3);
      return { from: fmt(d), to: todayStr };
    }
    default: return { from: '', to: '' };
  }
}

// ── Date preset dropdown (portal — escapes overflow:hidden parent) ────
function DatePresetDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePos = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { updatePos(); setOpen((v) => !v); }}
        className="ionix-input flex items-center justify-between gap-2 cursor-pointer text-sm"
      >
        <span className="flex items-center gap-2 text-white/80">
          <Calendar className="w-4 h-4 text-white/40 flex-shrink-0" />
          {DATE_PRESETS.find((p) => p.value === value)?.label ?? 'Selectează'}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed rounded-xl border border-border bg-card shadow-xl z-[9999] overflow-hidden animate-fade-in"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => { onChange(preset.value); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === preset.value
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 text-xs">
      {label}
      <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 leading-none">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Quick status dropdown per row (admin only) ────────────────────────
function QuickStatusSelect({ appId, currentStatus }: { appId: string; currentStatus: AppStatus }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: (status: AppStatus) =>
      api.patch(`/applications/${appId}/status`, { status }),
    onMutate: async (status) => {
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
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="absolute left-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-xl z-30 overflow-hidden"
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

// ── Main page ─────────────────────────────────────────────────────────
export default function ApplicationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────
  const [statusFilter, setStatusFilter]               = useState('');
  const [partnerFilter, setPartnerFilter]             = useState('');
  const [creditTypeFilter, setCreditTypeFilter]       = useState('');
  const [createdByFilter, setCreatedByFilter]         = useState('');
  const [statusChangedByFilter, setStatusChangedByFilter] = useState('');
  const [datePreset, setDatePreset]                   = useState('today');
  const [dateFrom, setDateFrom]                       = useState('');
  const [dateTo, setDateTo]                           = useState('');

  const activeFilterCount = [
    statusFilter, partnerFilter, creditTypeFilter,
    createdByFilter, statusChangedByFilter,
  ].filter(Boolean).length + (datePreset !== 'today' ? 1 : 0);

  // helper: set filter + reset to page 1
  const setF = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  const resetFilters = () => {
    setStatusFilter(''); setPartnerFilter(''); setCreditTypeFilter('');
    setCreatedByFilter(''); setStatusChangedByFilter('');
    setDatePreset('today'); setDateFrom(''); setDateTo('');
    setPage(1);
  };

  // ── Effective date range (computed from preset or custom inputs) ──
  const effectiveDateFrom = useMemo(() => {
    if (datePreset === 'custom') return dateFrom;
    return datePreset ? getPresetDates(datePreset).from : '';
  }, [datePreset, dateFrom]);

  const effectiveDateTo = useMemo(() => {
    if (datePreset === 'custom') return dateTo;
    return datePreset ? getPresetDates(datePreset).to : '';
  }, [datePreset, dateTo]);

  // ── Fetch users for dropdowns (admin only) ────────────────────────
  const { data: usersData } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
    enabled: user?.role === 'ADMIN',
  });

  const partners = useMemo(() => {
    if (!usersData) return [] as { id: string; name: string }[];
    const seen = new Set<string>();
    return usersData
      .filter((u: any) => u.partner && !seen.has(u.partner.id) && seen.add(u.partner.id))
      .map((u: any) => ({ id: u.partner.id, name: u.partner.companyName as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usersData]);

  const partnerUsers = useMemo(() => {
    if (!usersData) return [] as { id: string; name: string }[];
    return usersData
      .filter((u: any) => u.partner)
      .map((u: any) => ({ id: u.id as string, name: `${u.firstName} ${u.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usersData]);

  // ── Export ────────────────────────────────────────────────────────
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

  // ── Delete all ────────────────────────────────────────────────────
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

  // ── Rezultat contract (semnat / refuzat) → mesaj în Telegram ──────
  const [outcomeTarget, setOutcomeTarget] = useState<{ id: string; name: string; outcome: 'SIGNED' | 'REFUSED' } | null>(null);

  const { mutate: sendOutcome, isPending: outcomeLoading } = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'SIGNED' | 'REFUSED' }) =>
      api.patch(`/applications/${id}/contract-outcome`, { outcome }),
    onSuccess: (_, { outcome }) => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      setOutcomeTarget(null);
      toast({
        title: 'Mesaj trimis în Telegram!',
        description: outcome === 'SIGNED'
          ? 'Contractul a fost anunțat ca semnat.'
          : 'Refuzul clientului a fost transmis.',
      });
    },
    onError: (err: any) =>
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut trimite mesajul', variant: 'destructive' }),
  });

  // ── Query ─────────────────────────────────────────────────────────
  const queryParams = new URLSearchParams({ page: String(page), limit: '20' });
  if (statusFilter)           queryParams.set('status', statusFilter);
  if (partnerFilter)          queryParams.set('partnerId', partnerFilter);
  if (creditTypeFilter)       queryParams.set('creditType', creditTypeFilter);
  if (createdByFilter)        queryParams.set('createdByUserId', createdByFilter);
  if (statusChangedByFilter)  queryParams.set('statusChangedBy', statusChangedByFilter);
  if (effectiveDateFrom)      queryParams.set('dateFrom', effectiveDateFrom);
  if (effectiveDateTo)        queryParams.set('dateTo', effectiveDateTo);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page, statusFilter, partnerFilter, creditTypeFilter, createdByFilter, statusChangedByFilter, effectiveDateFrom, effectiveDateTo],
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

  const totalAmount = filtered.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header
        title="Cereri de Credit"
        subtitle={user?.role === 'ADMIN' ? 'Toate cererile' : 'Cererile tale'}
      />

      {/* ── Toolbar ──────────────────────────────────────────────── */}
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

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`ionix-input flex items-center gap-2 px-4 cursor-pointer whitespace-nowrap transition-colors ${
            activeFilterCount > 0 ? 'border-brand-500/40 text-brand-400' : 'text-white/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtre
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand-500/30 text-brand-400 text-xs flex items-center justify-center font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

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

      {/* ── Filter panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">

                {/* Partener (admin only) */}
                {user?.role === 'ADMIN' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">Partener</label>
                    <select
                      value={partnerFilter}
                      onChange={(e) => setF(setPartnerFilter)(e.target.value)}
                      className="ionix-input text-sm"
                    >
                      <option value="">Toți partenerii</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tip Credit */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">Tip Credit</label>
                  <select
                    value={creditTypeFilter}
                    onChange={(e) => setF(setCreditTypeFilter)(e.target.value)}
                    className="ionix-input text-sm"
                  >
                    <option value="">Toate tipurile</option>
                    <option value="ZERO">Credit Zero</option>
                    <option value="CLASSIC">Credit Clasic</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setF(setStatusFilter)(e.target.value)}
                    className="ionix-input text-sm"
                  >
                    <option value="">Toate statusurile</option>
                    <option value="PENDING">În așteptare</option>
                    <option value="PROCESSING">În procesare</option>
                    <option value="APPROVED">Aprobate</option>
                    <option value="REJECTED">Respinse</option>
                    <option value="CANCELLED">Anulate</option>
                  </select>
                </div>

                {/* Depus de (admin only) */}
                {user?.role === 'ADMIN' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">Depus de</label>
                    <select
                      value={createdByFilter}
                      onChange={(e) => setF(setCreatedByFilter)(e.target.value)}
                      className="ionix-input text-sm"
                    >
                      <option value="">Toți utilizatorii</option>
                      {partnerUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Modificat de */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">Modificat de</label>
                  <input
                    type="text"
                    value={statusChangedByFilter}
                    onChange={(e) => setF(setStatusChangedByFilter)(e.target.value)}
                    placeholder="Caută după nume..."
                    className="ionix-input text-sm"
                  />
                </div>

                {/* Perioadă — portal dropdown (escapes overflow:hidden) */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">Perioadă</label>
                  <DatePresetDropdown
                    value={datePreset}
                    onChange={(v) => {
                      setDatePreset(v);
                      if (v !== 'custom') { setDateFrom(''); setDateTo(''); }
                      setPage(1);
                    }}
                  />
                  {/* Custom date inputs — shown only for 'Perioada' */}
                  {datePreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                        className="ionix-input text-sm"
                      />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                        className="ionix-input text-sm"
                      />
                    </div>
                  )}
                </div>

              </div>

              {activeFilterCount > 0 && (
                <div className="flex justify-end pt-1 border-t border-white/8">
                  <button
                    onClick={resetFilters}
                    className="btn-ghost py-1 px-3 text-xs text-white/50 hover:text-white flex items-center gap-1.5"
                  >
                    <X className="w-3 h-3" /> Resetează toate filtrele
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal confirmare ștergere TOATE ──────────────────────── */}
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

      {/* ── Modal confirmare ștergere O cerere ───────────────────── */}
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

      {/* ── Modal confirmare rezultat contract ───────────────────── */}
      <AnimatePresence>
        {outcomeTarget && (
          <motion.div
            key="outcome-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setOutcomeTarget(null)}
          >
            <motion.div
              key="outcome-modal"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  outcomeTarget.outcome === 'SIGNED' ? 'bg-green-500/15' : 'bg-red-500/15'
                }`}>
                  {outcomeTarget.outcome === 'SIGNED'
                    ? <PenLine className="w-5 h-5 text-green-400" />
                    : <XCircle className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {outcomeTarget.outcome === 'SIGNED' ? 'Contract semnat' : 'Client a refuzat'}
                  </h3>
                  <p className="text-sm text-white/50">
                    Pentru cererea lui <span className="text-white font-medium">{outcomeTarget.name}</span> se va
                    trimite mesajul{' '}
                    <span className={`font-medium ${outcomeTarget.outcome === 'SIGNED' ? 'text-green-400' : 'text-red-400'}`}>
                      "{outcomeTarget.outcome === 'SIGNED' ? 'Contract semnat' : 'Client a refuzat'}"
                    </span>{' '}
                    în grupul Telegram. Acțiunea se poate face o singură dată.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setOutcomeTarget(null)} className="btn-ghost border border-white/10" disabled={outcomeLoading}>
                  Anulează
                </button>
                <button
                  onClick={() => sendOutcome({ id: outcomeTarget.id, outcome: outcomeTarget.outcome })}
                  disabled={outcomeLoading}
                  className="btn-primary"
                >
                  {outcomeLoading ? <span className="flex items-center gap-2"><Send className="w-4 h-4 animate-pulse" /> Se trimite...</span> : <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Trimite în Telegram</span>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter chips ───────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40">Filtre active:</span>
          {statusFilter && (
            <FilterChip
              label={statusConfig[statusFilter as AppStatus]?.label ?? statusFilter}
              onRemove={() => setF(setStatusFilter)('')}
            />
          )}
          {partnerFilter && (
            <FilterChip
              label={partners.find((p) => p.id === partnerFilter)?.name ?? 'Partener'}
              onRemove={() => setF(setPartnerFilter)('')}
            />
          )}
          {creditTypeFilter && (
            <FilterChip
              label={creditTypeFilter === 'ZERO' ? 'Credit Zero' : 'Credit Clasic'}
              onRemove={() => setF(setCreditTypeFilter)('')}
            />
          )}
          {createdByFilter && (
            <FilterChip
              label={partnerUsers.find((u) => u.id === createdByFilter)?.name ?? 'Depus de'}
              onRemove={() => setF(setCreatedByFilter)('')}
            />
          )}
          {statusChangedByFilter && (
            <FilterChip
              label={`Modificat: ${statusChangedByFilter}`}
              onRemove={() => setF(setStatusChangedByFilter)('')}
            />
          )}
          {datePreset !== 'today' && (
            <FilterChip
              label={`Data: ${DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? datePreset}`}
              onRemove={() => { setDatePreset('today'); setDateFrom(''); setDateTo(''); setPage(1); }}
            />
          )}
          {data && <span className="text-xs text-white/30">{data.total} rezultate</span>}
        </motion.div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
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
                  {user?.role === 'ADMIN' && <th className="hidden md:table-cell">Partener</th>}
                  <th className="hidden md:table-cell">Tip Credit</th>
                  <th>Sumă</th>
                  <th className="hidden md:table-cell">Termen</th>
                  <th className="hidden md:table-cell">Rată / lună</th>
                  <th className="hidden md:table-cell">Status</th>
                  <th className="hidden md:table-cell">Depus de</th>
                  <th className="hidden md:table-cell">Modificat de</th>
                  <th className="hidden md:table-cell">Data cererii</th>
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
                      onClick={() => router.push(`/applications/${app.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[.04]"
                      title="Deschide fișa cererii"
                    >
                      <td>
                        <div className="font-medium text-white truncate max-w-[130px] sm:max-w-none">{app.clientFirstName} {app.clientLastName}</div>
                        <div className="text-xs text-white/35 font-mono">{app.clientIdnp}</div>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="hidden md:table-cell text-white/60 text-xs">{app.partner?.companyName}</td>
                      )}
                      <td className="hidden md:table-cell">
                        <span className={`badge text-xs ${app.creditType === 'ZERO' ? 'badge-green' : 'badge-blue'}`}>
                          {app.creditType === 'ZERO' ? 'Zero' : 'Clasic'}
                        </span>
                      </td>
                      <td className="font-mono text-white/80 whitespace-nowrap">{formatMDL(app.amount)}</td>
                      <td className="hidden md:table-cell text-white/60">{app.months} luni</td>
                      <td className="hidden md:table-cell font-mono text-brand-400">{formatMDL(app.monthlyPayment)}</td>
                      <td className="hidden md:table-cell">
                        {user?.role === 'ADMIN' ? (
                          <QuickStatusSelect appId={app.id} currentStatus={app.status as AppStatus} />
                        ) : (
                          sc && <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                        )}
                        {app.contractOutcome && (
                          <div className={`text-[10px] mt-1 font-medium ${
                            app.contractOutcome === 'SIGNED' ? 'text-green-400/80' : 'text-red-400/80'
                          }`}>
                            {app.contractOutcome === 'SIGNED' ? '✍ Contract semnat' : '✗ Client a refuzat'}
                          </div>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-white/50 text-xs">
                        {app.createdByUser
                          ? `${app.createdByUser.firstName} ${app.createdByUser.lastName}`
                          : <span className="text-white/20">—</span>}
                      </td>
                      <td className="hidden md:table-cell text-white/50 text-xs">
                        {app.statusChangedByName ?? <span className="text-white/20">—</span>}
                      </td>
                      <td className="hidden md:table-cell text-white/40 text-xs">{formatDate(app.createdAt)}</td>
                      <td>
                        {/* Fişa se deschide apăsând rândul. Butoanele de aici fac
                            altceva, deci opresc apăsarea să urce mai departe —
                            altfel „şterge" ar şi deschide fişa în acelaşi timp. */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {app.status === 'APPROVED' && !app.contractOutcome &&
                            user?.role !== 'VIEWER' && (
                            <>
                              <button
                                onClick={() => setOutcomeTarget({
                                  id: app.id,
                                  name: `${app.clientFirstName} ${app.clientLastName}`,
                                  outcome: 'SIGNED',
                                })}
                                className="btn-ghost px-2 py-1.5 text-green-400/60 hover:text-green-400 hover:bg-green-500/10"
                                title="Contract semnat — anunță în Telegram"
                              >
                                <PenLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setOutcomeTarget({
                                  id: app.id,
                                  name: `${app.clientFirstName} ${app.clientLastName}`,
                                  outcome: 'REFUSED',
                                })}
                                className="btn-ghost px-2 py-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                                title="Client a refuzat — anunță în Telegram"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {user?.role === 'ADMIN' && (
                            <span className="hidden md:inline-flex">
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
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-white/30">
                      {search ? 'Niciun rezultat pentru căutare' : activeFilterCount ? 'Nicio cerere pentru filtrele selectate' : 'Nu există cereri încă'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-white/10">
                    <td className="py-3 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Total ({filtered.length})
                    </td>
                    {user?.role === 'ADMIN' && <td className="hidden md:table-cell" />}
                    <td className="hidden md:table-cell" />
                    <td className="py-3 px-4 font-mono font-semibold text-white whitespace-nowrap">
                      {formatMDL(totalAmount)}
                    </td>
                    <td className="hidden md:table-cell" colSpan={6} />
                    <td />
                  </tr>
                </tfoot>
              )}
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
