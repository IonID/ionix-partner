'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, UserCheck, UserX, Loader2, Upload,
  Users, ShieldCheck, Eye, Send,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PartnerAvatar } from '@/components/PartnerAvatar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

interface PartnerData {
  id: string;
  companyName: string;
  logoPath: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramEnabled: boolean;
  users: { id: string; firstName: string; lastName: string; email: string | null; username: string | null; isActive: boolean; role: string }[];
}
interface UserRow {
  id: string; email: string | null; username: string | null;
  firstName: string; lastName: string;
  role: string; isActive: boolean; createdAt: string; partner: PartnerData | null;
}

// ── Logo upload ──────────────────────────────────────────────────────
function LogoUpload({ partner }: { partner: PartnerData }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post(`/users/partners/${partner.id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Logo actualizat!' });
    } catch (err: any) {
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Upload eșuat', variant: 'destructive' });
    } finally { setUploading(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <PartnerAvatar logoPath={partner.logoPath} companyName={partner.companyName} size="md" />
      <button onClick={() => ref.current?.click()} disabled={uploading}
        className="btn-ghost py-1 px-2 text-xs border border-white/15 hover:border-white/30" title="Schimbă logo">
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
      </button>
      <input ref={ref} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}

// ── Telegram config per partner ──────────────────────────────────────
function TelegramConfig({ partner }: { partner: PartnerData }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    telegramBotToken: partner.telegramBotToken ?? '',
    telegramChatId: partner.telegramChatId ?? '',
    telegramEnabled: partner.telegramEnabled,
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.patch(`/users/partners/${partner.id}/telegram`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Telegram salvat!' }); setOpen(false); },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const hasConfig = !!(partner.telegramBotToken && partner.telegramChatId);

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className={`btn-ghost px-2 py-1.5 ${hasConfig ? 'text-blue-400/80 hover:text-blue-400' : 'text-white/30 hover:text-white/60'}`}
        title="Configurare Telegram">
        <Send className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-lg bg-blue-500/6 border border-blue-500/20 space-y-2.5 min-w-[320px]">
              <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <Send className="w-3 h-3" /> Telegram — {partner.companyName}
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40">Bot Token</label>
                <input type="password" value={form.telegramBotToken}
                  onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })}
                  placeholder="123456:ABC-DEF..."
                  className="ionix-input text-xs py-1.5 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40">Chat ID</label>
                <input type="text" value={form.telegramChatId}
                  onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                  placeholder="-1001234567890"
                  className="ionix-input text-xs py-1.5 font-mono" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Notificări active</span>
                <button type="button"
                  onClick={() => setForm({ ...form, telegramEnabled: !form.telegramEnabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.telegramEnabled ? 'bg-blue-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.telegramEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => save()} disabled={isPending} className="btn-primary py-1 px-3 text-xs">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Salvează
                </button>
                <button onClick={() => setOpen(false)} className="btn-ghost py-1 px-2 text-xs">Anulează</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Role badge ───────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  if (role === 'PARTNER_ADMIN') return (
    <span className="badge badge-green text-xs flex items-center gap-1 w-fit">
      <ShieldCheck className="w-2.5 h-2.5" /> Admin Partener
    </span>
  );
  if (role === 'MANAGER') return (
    <span className="badge badge-blue text-xs flex items-center gap-1 w-fit">
      <Users className="w-2.5 h-2.5" /> Manager
    </span>
  );
  if (role === 'VIEWER') return (
    <span className="badge badge-gray text-xs flex items-center gap-1 w-fit">
      <Eye className="w-2.5 h-2.5" /> Viewer
    </span>
  );
  return (
    <span className="badge badge-green text-xs flex items-center gap-1 w-fit">
      <Users className="w-2.5 h-2.5" /> Partner
    </span>
  );
}

// ── Partner card ─────────────────────────────────────────────────────
function PartnerCard({ owner, partner, onToggle, onDelete, onAddUser }: {
  owner: UserRow; partner: PartnerData;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onAddUser: (partnerId: string, partnerName: string) => void;
}) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header partener */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <LogoUpload partner={partner} />
          <div>
            <div className="font-semibold text-white">{partner.companyName}</div>
            <div className="text-xs text-white/35">
              {partner.users.length} utilizator{partner.users.length !== 1 ? 'i' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TelegramConfig partner={partner} />
          <button onClick={() => onAddUser(partner.id, partner.companyName)}
            className="btn-ghost px-2 py-1.5 text-blue-400/70 hover:text-blue-400" title="Adaugă utilizator">
            <Users className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { if (confirm(`Ștergi partenerul ${partner.companyName}?`)) onDelete(owner.id); }}
            className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400" title="Șterge partener">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lista utilizatori */}
      <div className="divide-y divide-white/5">
        {partner.users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-white/60">
                  {u.firstName[0]}{u.lastName[0]}
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white text-sm">{u.firstName} {u.lastName}</div>
                <div className="text-xs text-white/35 truncate">{u.username ?? u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <RoleBadge role={u.role} />
              <span className={`badge text-xs ${u.isActive ? 'badge-green' : 'badge-gray'}`}>
                {u.isActive ? 'Activ' : 'Inactiv'}
              </span>
              <button onClick={() => onToggle(u.id, !u.isActive)}
                className={`btn-ghost px-2 py-1.5 ${u.isActive ? 'text-yellow-400/70 hover:text-yellow-400' : 'text-green-400/70 hover:text-green-400'}`}
                title={u.isActive ? 'Dezactivează' : 'Activează'}>
                {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { if (confirm(`Ștergi utilizatorul ${u.username ?? u.email}?`)) onDelete(u.id); }}
                className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
type FormRole = 'PARTNER_ADMIN' | 'MANAGER' | 'ADMIN' | 'VIEWER';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [addToPartnerId, setAddToPartnerId] = useState<string | null>(null);
  const [addToPartnerName, setAddToPartnerName] = useState('');

  const emptyForm = {
    email: '', username: '', firstName: '', lastName: '', password: '',
    companyName: '',
    role: 'PARTNER_ADMIN' as FormRole,
  };
  const [form, setForm] = useState(emptyForm);

  const { data: users, isLoading } = useQuery<UserRow[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  });

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false); setAddToPartnerId(null); setForm(emptyForm);
      toast({ title: addToPartnerId ? 'Utilizator adăugat!' : (form.role === 'ADMIN' || form.role === 'VIEWER') ? 'Cont sistem creat!' : 'Partener creat!' });
    },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const { mutate: toggleUser } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { mutate: deleteUser } = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const isSystemRole = form.role === 'ADMIN' || form.role === 'VIEWER';

  const handleCreate = () => {
    if (addToPartnerId) {
      createUser({
        username: form.username || undefined,
        email: form.email || undefined,
        firstName: form.firstName, lastName: form.lastName,
        password: form.password, role: form.role, partnerId: addToPartnerId,
      });
    } else if (isSystemRole) {
      createUser({
        email: form.email,
        firstName: form.firstName, lastName: form.lastName,
        password: form.password, role: form.role,
      });
    } else {
      createUser({
        username: form.username || undefined,
        email: form.email || undefined,
        firstName: form.firstName, lastName: form.lastName,
        password: form.password,
        partner: { companyName: form.companyName },
      });
    }
  };

  const openAddUser = (partnerId: string, partnerName: string) => {
    setAddToPartnerId(partnerId); setAddToPartnerName(partnerName);
    setForm({ ...emptyForm, role: 'MANAGER' }); setShowForm(true);
  };

  const seen = new Set<string>();
  const uniquePartnerRows = (users ?? [])
    .filter((u) => u.partner)
    .filter((u) => {
      if (!u.partner || seen.has(u.partner.id)) return false;
      seen.add(u.partner.id); return true;
    });
  const systemUsers = (users ?? []).filter((u) => u.role === 'ADMIN' || u.role === 'VIEWER');

  const roleOptions: Array<{ value: FormRole; label: string; icon: React.ReactNode; hint: string }> =
    addToPartnerId
      ? [
          { value: 'MANAGER', label: 'Manager', icon: <Users className="w-3 h-3" />, hint: 'Depune și vede toate cererile partenerului' },
          { value: 'PARTNER_ADMIN', label: 'Admin Partener', icon: <ShieldCheck className="w-3 h-3" />, hint: 'Poate anula orice cerere a partenerului' },
        ]
      : [
          { value: 'PARTNER_ADMIN', label: 'Partener', icon: <Users className="w-3 h-3" />, hint: 'Companie nouă — primul utilizator devine Admin Partener' },
          { value: 'ADMIN', label: 'Admin Sistem', icon: <ShieldCheck className="w-3 h-3" />, hint: 'Acces complet sistem' },
          { value: 'VIEWER', label: 'Viewer Sistem', icon: <Eye className="w-3 h-3" />, hint: 'Vizualizare sistem, fără acțiuni' },
        ];

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header title="Gestionare Parteneri" subtitle="Parteneri, logo-uri, utilizatori și Telegram per grup" />

      <div className="flex justify-end">
        <button onClick={() => { setAddToPartnerId(null); setForm(emptyForm); setShowForm(!showForm); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Utilizator / Partener Nou
        </button>
      </div>

      {/* ── Create form ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="glass-card p-6 overflow-hidden">

            <div className="flex items-start justify-between mb-4 gap-4">
              <h3 className="text-sm font-semibold text-white">
                {addToPartnerId ? `Utilizator Nou — ${addToPartnerName}` : 'Cont Nou'}
              </h3>
              <div className="flex rounded-lg overflow-hidden border border-white/15">
                {roleOptions.map((r) => (
                  <button key={r.value} type="button"
                    onClick={() => setForm({ ...emptyForm, role: r.value })}
                    title={r.hint}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                      form.role === r.value
                        ? r.value === 'ADMIN'         ? 'bg-blue-500/25 text-blue-300'
                        : r.value === 'VIEWER'        ? 'bg-gray-500/25 text-gray-300'
                        : r.value === 'PARTNER_ADMIN' ? 'bg-brand-500/20 text-brand-400'
                        : 'bg-purple-500/20 text-purple-300'
                        : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                    }`}>
                    {r.icon}{r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Username field — for partner accounts */}
              {!isSystemRole && (
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50">Username</label>
                  <input type="text" value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="ihouse_admin" className="ionix-input" autoComplete="off" />
                </div>
              )}

              {/* Email field — for system accounts or optional for partner */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">{isSystemRole ? 'Email' : 'Email (opțional)'}</label>
                <input type="text" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={isSystemRole ? 'admin@pin.md' : 'optonal@email.md'} className="ionix-input" />
              </div>

              {[
                { label: 'Parolă', key: 'password', placeholder: 'Minim 8 caractere', type: 'password' },
                { label: 'Prenume', key: 'firstName', placeholder: 'Ion', type: 'text' },
                { label: 'Nume', key: 'lastName', placeholder: 'Popescu', type: 'text' },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-xs text-white/50">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} className="ionix-input" />
                </div>
              ))}

              {!addToPartnerId && !isSystemRole && (
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50">Denumire Companie</label>
                  <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="iHouse SRL" className="ionix-input" />
                </div>
              )}
            </div>

            {form.role === 'MANAGER' && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-purple-500/8 border border-purple-500/20 text-xs text-purple-300/80 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                Manager-ul poate depune și vedea toate cererile partenerului, dar poate anula doar propriile cereri.
              </div>
            )}
            {form.role === 'PARTNER_ADMIN' && addToPartnerId && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-brand-500/8 border border-brand-500/20 text-xs text-brand-400/80 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                Admin Partener poate anula orice cerere a companiei sale.
              </div>
            )}
            {form.role === 'VIEWER' && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-gray-500/8 border border-gray-500/20 text-xs text-gray-300/80 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                Viewer-ul poate vedea toate cererile din sistem, fără a putea efectua acțiuni.
              </div>
            )}
            {form.role === 'ADMIN' && !addToPartnerId && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-blue-500/8 border border-blue-500/20 text-xs text-blue-400/80 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                Administratorii au acces complet: cereri, parteneri, setări, statusuri.
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={isPending} className="btn-primary">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {addToPartnerId ? 'Adaugă Utilizator' : isSystemRole ? 'Creează Cont Sistem' : 'Creează Partener'}
              </button>
              <button onClick={() => { setShowForm(false); setAddToPartnerId(null); }} className="btn-ghost">Anulează</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Partners list ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse space-y-3">
              <div className="h-8 bg-white/8 rounded w-40" />
              <div className="h-10 bg-white/5 rounded" />
              <div className="h-10 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : uniquePartnerRows.length === 0 ? (
        <div className="glass-card p-10 text-center text-white/35 text-sm">Niciun partener înregistrat.</div>
      ) : (
        <div className="space-y-4">
          {uniquePartnerRows.map((owner) => (
            <PartnerCard key={owner.partner!.id} owner={owner} partner={owner.partner!}
              onToggle={(id, active) => toggleUser({ id, isActive: active })}
              onDelete={(id) => deleteUser(id)}
              onAddUser={openAddUser} />
          ))}
        </div>
      )}

      {/* ── System users (Admin + Viewer) ──────────────────────── */}
      {systemUsers.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400/70" />
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Conturi Sistem</h3>
          </div>
          <table className="ionix-table">
            <tbody>
              {systemUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium text-white">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-white/35">{u.email}</div>
                  </td>
                  <td>
                    {u.role === 'ADMIN' ? (
                      <span className="badge badge-blue text-xs flex items-center gap-1 w-fit">
                        <ShieldCheck className="w-3 h-3" /> ADMIN
                      </span>
                    ) : (
                      <span className="badge badge-gray text-xs flex items-center gap-1 w-fit">
                        <Eye className="w-3 h-3" /> VIEWER
                      </span>
                    )}
                  </td>
                  <td className="text-white/40 text-xs">{formatDate(u.createdAt)}</td>
                  <td>
                    <button onClick={() => { if (confirm(`Ștergi utilizatorul ${u.email}?`)) deleteUser(u.id); }}
                      className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
