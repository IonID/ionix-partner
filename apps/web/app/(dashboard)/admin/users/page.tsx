'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, UserCheck, UserX, Loader2, Upload,
  Users, ShieldCheck, Eye, Send, ChevronDown,
  Settings, Percent, Save, RotateCcw, AlertTriangle, KeyRound,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PartnerAvatar } from '@/components/PartnerAvatar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

interface SettingRow {
  key: string;
  value: string;
  type: string;
  label?: string;
  description?: string;
}

interface PartnerData {
  id: string;
  companyName: string;
  logoPath: string | null;
  calculatorConfig: Record<string, any> | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramAllowedUserIds: string | null;
  telegramEnabled: boolean;
  users: { id: string; firstName: string; lastName: string; email: string | null; username: string | null; isActive: boolean; role: string }[];
}
interface UserRow {
  id: string; email: string | null; username: string | null;
  firstName: string; lastName: string;
  role: string; isActive: boolean; createdAt: string; partner: PartnerData | null;
}

// ── Calculator keys that can be overridden per partner ────────────────
const CALC_KEYS = [
  'CLASSIC_ANNUAL_RATE', 'CLASSIC_ADMIN_FEE_RATE',
  'CLASSIC_MIN_AMOUNT', 'CLASSIC_MAX_AMOUNT',
  'CLASSIC_MIN_MONTHS', 'CLASSIC_MAX_MONTHS',
  'ZERO_MIN_AMOUNT', 'ZERO_MAX_AMOUNT',
  'ZERO_MIN_MONTHS', 'ZERO_MAX_MONTHS',
];

// ── Visual editor for the compensated interest table ─────────────────
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

  const months = Array.from({ length: 22 }, (_, i) => i + 3);

  return (
    <div className="w-full mt-1">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        {months.map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-white/40 w-7 text-right shrink-0">{m}L</span>
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
    </div>
  );
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
      await api.post(`/users/partners/${partner.id}/logo`, fd);
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
    telegramBotToken:       partner.telegramBotToken ?? '',
    telegramChatId:         partner.telegramChatId ?? '',
    telegramEnabled:        partner.telegramEnabled,
    telegramAllowedUserIds: partner.telegramAllowedUserIds ?? '',
  });
  const [regLoading, setRegLoading] = useState(false);

  // Sync form when partner data reloads (after save)
  useEffect(() => {
    setForm({
      telegramBotToken:       partner.telegramBotToken ?? '',
      telegramChatId:         partner.telegramChatId ?? '',
      telegramEnabled:        partner.telegramEnabled,
      telegramAllowedUserIds: partner.telegramAllowedUserIds ?? '',
    });
  }, [partner.telegramBotToken, partner.telegramChatId, partner.telegramEnabled, partner.telegramAllowedUserIds]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.patch(`/users/partners/${partner.id}/telegram`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast({ title: 'Telegram salvat!' }); setOpen(false); },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const registerWebhook = async () => {
    setRegLoading(true);
    try {
      const res = await api.post(`/telegram/register-webhook/${partner.id}`, {
        baseUrl: window.location.origin,
      });
      const data = res.data?.data ?? res.data;
      if (data?.ok) {
        toast({ title: '✅ Webhook înregistrat!', description: data.message });
      } else {
        toast({ title: 'Eroare webhook', description: data?.message ?? 'Necunoscut', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut înregistra webhook-ul', variant: 'destructive' });
    } finally {
      setRegLoading(false);
    }
  };

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
              <div className="space-y-1">
                <label className="text-[10px] text-white/40">ID-uri autorizate (separate prin virgulă)</label>
                <input type="text" value={form.telegramAllowedUserIds}
                  onChange={(e) => setForm({ ...form, telegramAllowedUserIds: e.target.value })}
                  placeholder="123456789, 987654321"
                  className="ionix-input text-xs py-1.5 font-mono" />
                <p className="text-[10px] text-white/25">Lasă gol pentru a permite tuturor · Doar ID-uri numerice Telegram (nu @username)</p>

                {/* Chips cu ID-urile active salvate în DB */}
                {partner.telegramAllowedUserIds && (() => {
                  const entries = partner.telegramAllowedUserIds!
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  const valid   = entries.filter(s => /^\d+$/.test(s));
                  const invalid = entries.filter(s => !/^\d+$/.test(s));
                  return (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">
                        Salvate în DB — {valid.length} ID numeric{valid.length !== 1 ? 'e' : ''} active:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {valid.map(id => (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                            ✅ {id}
                          </span>
                        ))}
                        {invalid.map(id => (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-mono text-red-300" title="Username-urile @... nu sunt suportate — folosește ID-ul numeric">
                            ⚠️ {id}
                          </span>
                        ))}
                      </div>
                      {invalid.length > 0 && (
                        <p className="text-[10px] text-red-400/70">
                          ⚠️ ID-urile marcate cu ⚠️ sunt username-uri (@...) și sunt ignorate. Înlocuiește-le cu ID-ul numeric Telegram.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Notificări active</span>
                <button type="button"
                  onClick={() => setForm({ ...form, telegramEnabled: !form.telegramEnabled })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.telegramEnabled ? 'bg-blue-500' : 'bg-white/15'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.telegramEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <div className="flex gap-2 pt-1 flex-wrap">
                <button onClick={() => save()} disabled={isPending} className="btn-primary py-1 px-3 text-xs">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Salvează
                </button>
                {hasConfig && (
                  <button onClick={registerWebhook} disabled={regLoading}
                    className="btn-ghost py-1 px-3 text-xs border border-blue-500/30 text-blue-400/80 hover:text-blue-400 hover:border-blue-500/60"
                    title="Re-înregistrează webhook-ul Telegram">
                    {regLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Webhook
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="btn-ghost py-1 px-2 text-xs">Anulează</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Calculator config per partner ────────────────────────────────────
function CalculatorConfig({ partner }: { partner: PartnerData }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Fetch global settings (cached by React Query)
  const { data: allSettings } = useQuery<SettingRow[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data.data),
    enabled: open,
  });

  // form: only keys with partner-specific values (empty key = not overriding)
  const [form, setForm] = useState<Record<string, string>>({});
  // separate state for whether the commission table is being overridden
  const [tableOverride, setTableOverride] = useState(false);
  const [tableValue, setTableValue] = useState('');
  // tipuri de credit active pentru acest partener
  const [allowedTypes, setAllowedTypes] = useState<('ZERO' | 'CLASSIC')[]>(['ZERO', 'CLASSIC']);

  // Sync form from partner.calculatorConfig whenever it changes or panel opens
  useEffect(() => {
    if (!open) return;
    const cfg = partner.calculatorConfig ?? {};
    const newForm: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg)) {
      if (k !== 'ZERO_COMMISSION_TABLE' && k !== 'ALLOWED_CREDIT_TYPES') {
        newForm[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
      }
    }
    setForm(newForm);

    if (cfg['ZERO_COMMISSION_TABLE'] !== undefined) {
      const raw = cfg['ZERO_COMMISSION_TABLE'];
      setTableOverride(true);
      setTableValue(typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
    } else {
      setTableOverride(false);
      setTableValue('');
    }

    const existingAllowed = cfg['ALLOWED_CREDIT_TYPES'];
    if (Array.isArray(existingAllowed)) {
      setAllowedTypes(existingAllowed.filter((t: any) => t === 'ZERO' || t === 'CLASSIC') as ('ZERO' | 'CLASSIC')[]);
    } else {
      setAllowedTypes(['ZERO', 'CLASSIC']);
    }
  }, [open, partner.calculatorConfig]);

  const globalMap = useMemo(() => {
    if (!allSettings) return {} as Record<string, SettingRow>;
    return Object.fromEntries(allSettings.map((s: SettingRow) => [s.key, s]));
  }, [allSettings]);

  const hasOverrides = !!(
    partner.calculatorConfig && Object.keys(partner.calculatorConfig).length > 0
  );

  const getGlobal = (key: string) => globalMap[key]?.value ?? '';
  const getLabel = (key: string) => globalMap[key]?.label ?? key;

  const handleFieldChange = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev };
      if (value === '') { delete next[key]; } else { next[key] = value; }
      return next;
    });
  };

  // When toggling the commission table override ON, pre-fill with global values
  const handleTableToggle = (on: boolean) => {
    setTableOverride(on);
    if (on && !tableValue) {
      setTableValue(getGlobal('ZERO_COMMISSION_TABLE') || '{}');
    }
  };

  const buildPayload = (): Record<string, any> => {
    const result: Record<string, any> = { ...form };
    if (tableOverride && tableValue) {
      try { result['ZERO_COMMISSION_TABLE'] = JSON.parse(tableValue); }
      catch { result['ZERO_COMMISSION_TABLE'] = tableValue; }
    }
    result['ALLOWED_CREDIT_TYPES'] = allowedTypes;
    return result;
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.patch(`/users/partners/${partner.id}/calculator`, {
      calculatorConfig: buildPayload(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Calculator salvat!', description: `Setări specifice pentru ${partner.companyName}` });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const { mutate: resetToGlobal, isPending: resetting } = useMutation({
    mutationFn: () => api.patch(`/users/partners/${partner.id}/calculator`, { calculatorConfig: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm({});
      setTableOverride(false);
      setTableValue('');
      toast({ title: 'Resetat la setările globale', description: partner.companyName });
      setOpen(false);
    },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn-ghost px-2 py-1.5 ${hasOverrides ? 'text-brand-400/80 hover:text-brand-400' : 'text-white/30 hover:text-white/60'}`}
        title={hasOverrides ? 'Calculator personalizat activ' : 'Configurare Calculator (folosește valorile globale)'}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-4 rounded-lg bg-brand-500/6 border border-brand-500/20 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-brand-400 flex items-center gap-1.5">
                  <Settings className="w-3 h-3" /> Calculator — {partner.companyName}
                </p>
                {hasOverrides && (
                  <span className="text-[10px] text-brand-400/60 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Setări personalizate active
                  </span>
                )}
              </div>

              <p className="text-[10px] text-white/30">
                Lăsați câmpul gol pentru a folosi valoarea globală. Doar câmpurile completate vor suprascrie setările globale.
              </p>

              {/* ── Tipuri de credit active ──────────────────────── */}
              <div className="border-b border-white/8 pb-3 space-y-2">
                <p className="text-xs font-medium text-white/60">Tipuri de credit active</p>
                <div className="flex flex-col gap-1.5">
                  {(['ZERO', 'CLASSIC'] as const).map((type) => {
                    const isActive = allowedTypes.includes(type);
                    return (
                      <div
                        key={type}
                        className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors ${isActive ? 'bg-brand-500/8 border border-brand-500/15' : 'border border-transparent hover:bg-white/2'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${type === 'ZERO' ? 'bg-green-400' : 'bg-blue-400'}`} />
                          <span className="text-xs text-white/60">Credit {type === 'ZERO' ? 'Zero' : 'Clasic'}</span>
                        </div>
                        <button
                          type="button"
                          title={allowedTypes.length === 1 && isActive ? 'Cel puțin un tip trebuie să fie activ' : ''}
                          onClick={() => {
                            setAllowedTypes(prev => {
                              if (prev.includes(type)) {
                                const next = prev.filter(t => t !== type);
                                return next.length > 0 ? next : prev; // nu permite dezactivarea ultimului tip
                              }
                              return [...prev, type];
                            });
                          }}
                          className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? 'bg-brand-500' : 'bg-white/15'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Numeric params ───────────────────────────────── */}
              <div className="space-y-1">
                {CALC_KEYS.map((key) => (
                  <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded ${form[key] !== undefined ? 'bg-brand-500/8 border border-brand-500/15' : 'hover:bg-white/2'}`}>
                    <span className="text-xs text-white/60 flex-1 min-w-0 truncate">{getLabel(key)}</span>
                    <span className="text-[10px] text-white/20 font-mono shrink-0">
                      global: {getGlobal(key) || '—'}
                    </span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form[key] ?? ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      placeholder={getGlobal(key) || '—'}
                      className="ionix-input font-mono text-xs py-1 w-24 text-right shrink-0"
                    />
                  </div>
                ))}
              </div>

              {/* ── Commission table override ────────────────────── */}
              <div className="border-t border-white/8 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                    <Percent className="w-3 h-3" /> Dobândă Compensată Credit Zero
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/35">
                      {tableOverride ? 'Tabel personalizat' : 'Folosește tabelul global'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTableToggle(!tableOverride)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${tableOverride ? 'bg-brand-500' : 'bg-white/15'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tableOverride ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {tableOverride && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <ZeroCommissionEditor
                        value={tableValue || '{}'}
                        onChange={setTableValue}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Actions ──────────────────────────────────────── */}
              <div className="flex gap-2 pt-1 flex-wrap border-t border-white/8">
                <button onClick={() => save()} disabled={isPending || resetting} className="btn-primary py-1 px-3 text-xs">
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvează
                </button>
                {hasOverrides && (
                  <button
                    onClick={() => { if (confirm(`Resetezi calculatorul pentru ${partner.companyName} la valorile globale?`)) resetToGlobal(); }}
                    disabled={resetting || isPending}
                    className="btn-ghost py-1 px-3 text-xs border border-white/15 hover:border-red-400/30 hover:text-red-400/80"
                    title="Șterge toate setările specifice și revino la valorile globale"
                  >
                    {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Resetează la global
                  </button>
                )}
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

// ── Partner user row with inline password change ─────────────────────
function PartnerUserRow({ u, onToggle, onDelete }: {
  u: PartnerData['users'][number];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: () => api.patch(`/users/${u.id}`, { password }),
    onSuccess: () => {
      toast({ title: 'Parola schimbată!', description: `${u.firstName} ${u.lastName}` });
      setPwOpen(false); setPassword(''); setConfirmPw('');
    },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const valid = password.length >= 8 && password === confirmPw;

  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-white/60">{u.firstName[0]}{u.lastName[0]}</span>
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
          <button
            onClick={() => { setPwOpen((v) => !v); setPassword(''); setConfirmPw(''); }}
            className={`btn-ghost px-2 py-1.5 ${pwOpen ? 'text-yellow-400/80' : 'text-white/30 hover:text-white/60'}`}
            title="Schimbă parola">
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onToggle(u.id, !u.isActive)}
            className={`btn-ghost px-2 py-1.5 ${u.isActive ? 'text-yellow-400/70 hover:text-yellow-400' : 'text-green-400/70 hover:text-green-400'}`}
            title={u.isActive ? 'Dezactivează' : 'Activează'}>
            {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { if (window.confirm(`Ștergi utilizatorul ${u.username ?? u.email}?`)) onDelete(u.id); }}
            className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {pwOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-3 bg-yellow-500/4 border-t border-yellow-500/15 flex items-center gap-2 flex-wrap">
              <KeyRound className="w-3.5 h-3.5 text-yellow-400/60 flex-shrink-0" />
              <span className="text-xs text-white/50 flex-shrink-0">Parolă nouă:</span>
              <input type="password" placeholder="Minim 8 caractere" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ionix-input text-sm py-1.5 flex-1 min-w-[8rem]" />
              <input type="password" placeholder="Confirmă parola" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="ionix-input text-sm py-1.5 flex-1 min-w-[8rem]" />
              <button onClick={() => changePassword()} disabled={!valid || isPending}
                className="btn-primary py-1.5 px-3 text-xs flex-shrink-0">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Salvează
              </button>
              <button onClick={() => setPwOpen(false)} className="btn-ghost py-1.5 px-2 text-xs flex-shrink-0">Anulează</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Partner card ─────────────────────────────────────────────────────
function PartnerCard({ owner, partner, onToggle, onDelete, onAddUser }: {
  owner: UserRow; partner: PartnerData;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onAddUser: (partnerId: string, partnerName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header partener */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <LogoUpload partner={partner} />
          <button onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white truncate">{partner.companyName}</div>
              <div className="text-xs text-white/35">
                {partner.users.length} utilizator{partner.users.length !== 1 ? 'i' : ''}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <TelegramConfig partner={partner} />
          <CalculatorConfig partner={partner} />
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

      {/* Lista utilizatori — accordion */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
      <div>
        {partner.users.map((u) => (
          <PartnerUserRow key={u.id} u={u} onToggle={onToggle} onDelete={onDelete} />
        ))}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── System user row with inline password change ───────────────────────
function SystemUserRow({ u, onDelete }: { u: UserRow; onDelete: (id: string) => void }) {
  const { toast } = useToast();
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: () => api.patch(`/users/${u.id}`, { password }),
    onSuccess: () => {
      toast({ title: 'Parola schimbată!', description: u.email ?? u.firstName });
      setPwOpen(false); setPassword(''); setConfirmPw('');
    },
    onError: (err: any) => toast({ title: 'Eroare', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const valid = password.length >= 8 && password === confirmPw;

  return (
    <>
      <tr>
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setPwOpen((v) => !v); setPassword(''); setConfirmPw(''); }}
              className={`btn-ghost px-2 py-1.5 ${pwOpen ? 'text-yellow-400/80' : 'text-white/30 hover:text-white/60'}`}
              title="Schimbă parola">
              <KeyRound className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { if (window.confirm(`Ștergi utilizatorul ${u.email}?`)) onDelete(u.id); }}
              className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {pwOpen && (
          <motion.tr
            key="pw-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <td colSpan={4} className="!p-0">
              <div className="px-5 py-3 bg-yellow-500/4 border-t border-yellow-500/15 flex items-center gap-2 flex-wrap">
                <KeyRound className="w-3.5 h-3.5 text-yellow-400/60 flex-shrink-0" />
                <span className="text-xs text-white/50 flex-shrink-0">{u.firstName} {u.lastName} — Parolă nouă:</span>
                <input type="password" placeholder="Minim 8 caractere" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ionix-input text-sm py-1.5 flex-1 min-w-[8rem]" />
                <input type="password" placeholder="Confirmă parola" value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="ionix-input text-sm py-1.5 flex-1 min-w-[8rem]" />
                <button onClick={() => changePassword()} disabled={!valid || isPending}
                  className="btn-primary py-1.5 px-3 text-xs flex-shrink-0">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  Salvează
                </button>
                <button onClick={() => setPwOpen(false)} className="btn-ghost py-1.5 px-2 text-xs flex-shrink-0">Anulează</button>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
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
      if (!form.username && !form.email) {
        toast({ title: 'Eroare', description: 'Trebuie specificat cel puțin username sau email', variant: 'destructive' });
        return;
      }
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
      if (!form.username && !form.email) {
        toast({ title: 'Eroare', description: 'Trebuie specificat cel puțin username sau email', variant: 'destructive' });
        return;
      }
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
      <Header title="Gestionare Parteneri" subtitle="Parteneri, logo-uri, utilizatori, Telegram și Calculator per grup" />

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
                  <label className="text-xs text-white/50">
                    Username <span className="text-white/30">(cel puțin username sau email)</span>
                  </label>
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
                  placeholder={isSystemRole ? 'admin@pin.md' : 'optional@email.md'} className="ionix-input" />
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
                <SystemUserRow key={u.id} u={u} onDelete={(id) => deleteUser(id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
