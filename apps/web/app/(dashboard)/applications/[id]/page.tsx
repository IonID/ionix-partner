'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, User, Phone, CreditCard,
  FileText, CheckCircle, Clock, XCircle, Download,
  ExternalLink, Loader2, AlertTriangle, ImageIcon, ShoppingBag, RotateCcw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatMDL, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────
type AppStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

const statusConfig: Record<AppStatus, { label: string; badge: string; icon: any }> = {
  PENDING:    { label: 'În așteptare',  badge: 'badge-yellow', icon: Clock },
  PROCESSING: { label: 'În procesare', badge: 'badge-blue',   icon: Clock },
  APPROVED:   { label: 'Aprobat',      badge: 'badge-green',  icon: CheckCircle },
  REJECTED:   { label: 'Respins',      badge: 'badge-red',    icon: XCircle },
  CANCELLED:  { label: 'Anulat',       badge: 'badge-gray',   icon: XCircle },
};

const docTypeLabel: Record<string, string> = {
  ID_FRONT: 'Față buletin',
  ID_BACK:  'Verso buletin',
  SELFIE:   'Selfie cu buletinul',
  OTHER:    'Alt document',
};

// ── Document viewer (loads via authenticated request) ─────────────
function DocThumb({ doc }: { doc: any }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async () => {
    if (blobUrl) { window.open(blobUrl, '_blank'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/documents/${doc.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setBlobUrl(url);
      window.open(url, '_blank');
    } finally {
      setLoading(false);
    }
  }, [doc.id, blobUrl]);

  const isImage = doc.mimeType?.startsWith('image/');

  return (
    <motion.button
      onClick={open}
      disabled={loading}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/4 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all p-4 min-h-[110px] text-left w-full"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      {loading ? (
        <Loader2 className="w-7 h-7 text-brand-400 animate-spin" />
      ) : isImage ? (
        <ImageIcon className="w-7 h-7 text-white/30" />
      ) : (
        <FileText className="w-7 h-7 text-white/30" />
      )}
      <div className="text-center">
        <p className="text-xs font-medium text-white/70">{docTypeLabel[doc.type] ?? doc.type}</p>
        <p className="text-[10px] text-white/30 mt-0.5 truncate max-w-[120px]">{doc.originalName}</p>
      </div>
      <ExternalLink className="absolute top-2 right-2 w-3 h-3 text-white/25" />
    </motion.button>
  );
}

// ── Status change panel (admin only) ─────────────────────────────
const PARTNER_NEXT_STATUSES: Record<AppStatus, AppStatus[]> = {
  PENDING:    ['PROCESSING', 'REJECTED', 'CANCELLED'],
  PROCESSING: ['APPROVED', 'REJECTED'],
  APPROVED:   [],
  REJECTED:   [],
  CANCELLED:  [],
};

const ALL_STATUSES = Object.keys({
  PENDING: 1, PROCESSING: 1, APPROVED: 1, REJECTED: 1, CANCELLED: 1,
}) as AppStatus[];

const statusActionLabel: Record<AppStatus, string> = {
  PENDING:    'Resetează în așteptare',
  PROCESSING: 'Marchează în procesare',
  APPROVED:   'Aprobă cererea',
  REJECTED:   'Respinge cererea',
  CANCELLED:  'Anulează cererea',
};

const statusActionClass: Record<AppStatus, string> = {
  PENDING:    'btn-ghost border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10',
  PROCESSING: 'btn-ghost border border-blue-500/40 text-blue-400 hover:bg-blue-500/10',
  APPROVED:   'btn-ghost border border-green-500/40 text-green-400 hover:bg-green-500/10',
  REJECTED:   'btn-ghost border border-red-500/40 text-red-400 hover:bg-red-500/10',
  CANCELLED:  'btn-ghost border border-white/20 text-white/50 hover:bg-white/8',
};

function StatusPanel({ app, isAdmin }: { app: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState(app.processorNotes ?? '');
  const [pendingStatus, setPendingStatus] = useState<AppStatus | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: ({ status, n }: { status: AppStatus; n: string }) =>
      api.patch(`/applications/${app.id}/status`, { status, notes: n || undefined }),
    onMutate: async ({ status, n }) => {
      await qc.cancelQueries({ queryKey: ['application', app.id] });
      const prev = qc.getQueryData(['application', app.id]);
      qc.setQueryData(['application', app.id], (old: any) =>
        old ? { ...old, status, processorNotes: n || old.processorNotes, updatedAt: new Date().toISOString() } : old,
      );
      return { prev };
    },
    onError: (err: any, _vars, ctx) => {
      qc.setQueryData(['application', app.id], ctx?.prev);
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut actualiza', variant: 'destructive' });
    },
    onSuccess: (_, { status }) => {
      toast({ title: 'Status actualizat!', description: `Cererea a fost marcată "${statusConfig[status]?.label}".` });
      setPendingStatus(null);
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['application', app.id] });
    },
  });

  const nextStatuses = isAdmin
    ? ALL_STATUSES.filter((s) => s !== app.status)
    : PARTNER_NEXT_STATUSES[app.status as AppStatus] ?? [];

  if (nextStatuses.length === 0) return null;

  const confirm = (status: AppStatus) => {
    setPendingStatus(status);
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Actualizare Status
      </h2>

      <div className="space-y-2">
        <label className="text-xs text-white/50">Note procesare (opțional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Adaugă note despre această cerere..."
          className="ionix-input resize-none text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((s) => (
          <button
            key={s}
            onClick={() => confirm(s)}
            className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${statusActionClass[s]}`}
          >
            {statusActionLabel[s]}
          </button>
        ))}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {pendingStatus && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3"
          >
            <p className="text-sm text-white/80">
              Confirmi schimbarea statusului la{' '}
              <span className={`font-semibold ${statusConfig[pendingStatus].badge.replace('badge-', 'text-').replace('yellow', 'yellow-400').replace('blue', 'blue-400').replace('green', 'green-400').replace('red', 'red-400').replace('gray', 'white/40')}`}>
                "{statusConfig[pendingStatus].label}"
              </span>
              ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => mutate({ status: pendingStatus!, n: notes })}
                disabled={isPending}
                className="btn-primary py-1.5 px-4 text-xs"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Confirmă
              </button>
              <button onClick={() => setPendingStatus(null)} className="btn-ghost py-1.5 px-3 text-xs">
                Anulează
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get(`/applications/${id}`).then((r) => r.data.data),
    enabled: !!id,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const isAdmin = user?.role === 'ADMIN';
  const isPartnerAdminOnManagerApp =
    user?.role === 'PARTNER_ADMIN' && app?.createdByUser?.role === 'MANAGER';
  const isPartnerAdmin = user?.role === 'PARTNER_ADMIN';
  const isManager = user?.role === 'MANAGER' || user?.role === 'PARTNER';
  const userPartnerId = user?.partner?.id ?? null;

  // Can cancel: PARTNER_ADMIN → any PENDING in partner; MANAGER → own PENDING
  const canCancel = app && app.status === 'PENDING' && (
    isAdmin ||
    (isPartnerAdmin && userPartnerId === app.partnerId) ||
    (isManager && app.createdByUser?.id === user?.id)
  );

  // Can resubmit: PARTNER_ADMIN → any CANCELLED in partner; MANAGER → own CANCELLED
  const canResubmit = app && app.status === 'CANCELLED' && (
    (isPartnerAdmin && userPartnerId === app.partnerId) ||
    (isManager && app.createdByUser?.id === user?.id)
  );

  const [confirmResubmit, setConfirmResubmit] = useState(false);

  const { mutate: cancelApp, isPending: cancelling } = useMutation({
    mutationFn: () => isAdmin
      ? api.patch(`/applications/${id}/status`, { status: 'CANCELLED' })
      : api.patch(`/applications/${id}/cancel`),
    onSuccess: () => {
      toast({ title: 'Cerere anulată', description: 'Cererea a fost anulată cu succes.' });
      setConfirmCancel(false);
      qc.invalidateQueries({ queryKey: ['application', id] });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err: any) =>
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut anula', variant: 'destructive' }),
  });

  const { mutate: resubmitApp, isPending: resubmitting } = useMutation({
    mutationFn: () => api.patch(`/applications/${id}/resubmit`),
    onSuccess: () => {
      toast({ title: 'Cerere repusă', description: 'Cererea a fost repusă în așteptare.' });
      setConfirmResubmit(false);
      qc.invalidateQueries({ queryKey: ['application', id] });
      qc.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (err: any) =>
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut repune', variant: 'destructive' }),
  });

  const downloadPdf = async () => {
    if (!app) return;
    setPdfLoading(true);
    try {
      const res = await api.post(
        '/reports/amortization-pdf',
        { creditType: app.creditType, amount: parseFloat(app.amount), months: app.months },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ionix-grafic-${app.clientLastName}-${app.clientFirstName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Eroare', description: 'Nu s-a putut genera PDF-ul', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-5">
        <Header title="Cerere de Credit" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse space-y-3">
              <div className="h-4 bg-white/10 rounded w-32" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 bg-white/6 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !app) {
    return (
      <div className="p-6 space-y-4">
        <Header title="Cerere de Credit" />
        <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
          <XCircle className="w-10 h-10 text-red-400/60" />
          <p className="text-white/50">Cererea nu a fost găsită sau nu ai acces la ea.</p>
          <button onClick={() => router.back()} className="btn-ghost mt-2">
            <ArrowLeft className="w-4 h-4" /> Înapoi
          </button>
        </div>
      </div>
    );
  }

  const sc = statusConfig[app.status as AppStatus];
  const StatusIcon = sc?.icon ?? Clock;

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header
        title="Detalii Cerere"
        subtitle={`${app.clientFirstName} ${app.clientLastName} · ${app.creditType === 'ZERO' ? 'Credit Zero' : 'Credit Clasic'}`}
      />

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => router.back()} className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Înapoi la liste
        </button>

        <div className="flex items-center gap-3">
          <span className={`badge ${sc?.badge} flex items-center gap-1.5 px-3 py-1`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {sc?.label}
          </span>

          {canCancel && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="btn-ghost text-sm border border-red-500/30 text-red-400/70 hover:border-red-500/60 hover:text-red-400"
            >
              <XCircle className="w-4 h-4" />
              Anulează cererea
            </button>
          )}

          {canResubmit && (
            <button
              onClick={() => setConfirmResubmit(true)}
              className="btn-ghost text-sm border border-yellow-500/30 text-yellow-400/70 hover:border-yellow-500/60 hover:text-yellow-400"
            >
              <RotateCcw className="w-4 h-4" />
              Repune cererea
            </button>
          )}

          <button
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="btn-ghost text-sm border border-white/15 hover:border-brand-500/40"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Graf rambursare PDF
          </button>
        </div>
      </div>

      {/* ── Cancel confirmation banner ────────────────────────── */}
      <AnimatePresence>
        {confirmCancel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-white/80">
                Ești sigur că vrei să anulezi această cerere?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => cancelApp()}
                disabled={cancelling}
                className="btn-ghost py-1.5 px-4 text-sm border border-red-500/40 text-red-400 hover:bg-red-500/15"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Da, anulează
              </button>
              <button onClick={() => setConfirmCancel(false)} className="btn-ghost py-1.5 px-4 text-sm">
                Renunță
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resubmit confirmation banner ─────────────────────── */}
      <AnimatePresence>
        {confirmResubmit && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-yellow-500/25 bg-yellow-500/8 px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-white/80">
                Repui cererea în așteptare? Va fi procesată din nou de operator.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resubmitApp()}
                disabled={resubmitting}
                className="btn-ghost py-1.5 px-4 text-sm border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/15"
              >
                {resubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Da, repune
              </button>
              <button onClick={() => setConfirmResubmit(false)} className="btn-ghost py-1.5 px-4 text-sm">
                Renunță
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Client info */}
          <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-brand-400" /> Date Client
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <InfoRow label="Nume complet" value={`${app.clientFirstName} ${app.clientLastName}`} mono={false} />
              <InfoRow label="Telefon" value={app.clientPhone} mono={false} icon={<Phone className="w-3.5 h-3.5 text-white/25" />} />
              <InfoRow label="Produs" value={app.clientIdnp ?? '—'} mono={false} icon={<ShoppingBag className="w-3.5 h-3.5 text-white/25" />} className="col-span-2" />
            </div>
          </motion.div>

          {/* Credit parameters */}
          <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-brand-400" /> Parametri Credit
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatBox label="Tip Credit" value={app.creditType === 'ZERO' ? 'Credit Zero' : 'Credit Clasic'} accent={app.creditType === 'ZERO' ? 'text-green-400' : 'text-blue-400'} />
              <StatBox label="Suma solicitată" value={formatMDL(app.amount)} />
              <StatBox label="Termen" value={`${app.months} luni`} />
              <StatBox label="Rată lunară" value={formatMDL(app.monthlyPayment)} accent="text-brand-400" />
              <StatBox label="Total plată (VTP)" value={formatMDL(app.totalAmount)} />
              <StatBox label="DAE" value={`${parseFloat(app.dae).toFixed(2)}%`} />
              {parseFloat(app.commissionAmount) > 0 && (
                <StatBox label="Comision partener" value={formatMDL(app.commissionAmount)} accent="text-yellow-400" />
              )}
            </div>
          </motion.div>

          {/* Documents */}
          {app.documents?.length > 0 && (
            <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-brand-400" /> Documente Încărcate
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {app.documents.map((doc: any) => (
                  <DocThumb key={doc.id} doc={doc} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Processor notes (read-only for partner) */}
          {app.processorNotes && user?.role !== 'ADMIN' && (
            <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Note Procesare</h2>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{app.processorNotes}</p>
            </motion.div>
          )}

          {/* Rejection reason */}
          {app.rejectionReason && (
            <motion.div className="glass-card p-5 border-red-500/20" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-xs font-semibold text-red-400/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5" /> Motiv Respingere
              </h2>
              <p className="text-sm text-white/70">{app.rejectionReason}</p>
            </motion.div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────── */}
        <div className="space-y-5">
          {/* Meta */}
          <motion.div className="glass-card p-5 space-y-3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Informații Cerere</h2>
            <div className="space-y-2.5">
              <InfoRow label="ID cerere" value={app.id.slice(0, 12) + '…'} mono />
              <InfoRow label="Partener" value={app.partner?.companyName ?? '—'} mono={false} />
              <InfoRow
                label="Depus de"
                value={app.createdByUser
                  ? `${app.createdByUser.firstName} ${app.createdByUser.lastName}`
                  : '—'}
                mono={false}
              />
              {app.statusChangedByName && (
                <InfoRow
                  label="Status modificat de"
                  value={app.statusChangedByName}
                  mono={false}
                />
              )}
              <InfoRow label="Dată creare" value={formatDate(app.createdAt)} mono={false} />
              <InfoRow label="Ultima modificare" value={formatDate(app.updatedAt)} mono={false} />
            </div>
          </motion.div>

          {/* Status change panel — Admin (orice cerere) sau Partner Admin (cereri Manager) */}
          {(isAdmin || isPartnerAdminOnManagerApp) && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
              <StatusPanel app={app} isAdmin={true} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────
function InfoRow({
  label, value, mono = false, icon, className = '',
}: { label: string; value: string; mono?: boolean; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-white/35 mb-0.5">{label}</p>
      <p className={`text-sm text-white/80 flex items-center gap-1.5 ${mono ? 'font-mono' : ''}`}>
        {icon}{value}
      </p>
    </div>
  );
}

function StatBox({ label, value, accent = 'text-white/85' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-semibold font-mono ${accent}`}>{value}</p>
    </div>
  );
}
