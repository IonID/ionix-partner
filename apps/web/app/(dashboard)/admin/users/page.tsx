'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '', companyName: '', commissionRate: 5 });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data),
  });

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setForm({ email: '', firstName: '', lastName: '', password: '', companyName: '', commissionRate: 5 });
      toast({ title: 'Partener creat!', description: 'Noul partener a fost adăugat cu succes.' });
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

  const handleCreate = () => {
    createUser({ ...form, role: 'PARTNER', partner: { companyName: form.companyName, commissionRate: form.commissionRate } });
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header title="Gestionare Parteneri" subtitle="Adăugați, editați sau dezactivați conturile de parteneri" />

      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Adaugă Partener
        </button>
      </div>

      {/* ── Create form ──────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-white mb-4">Partener Nou</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="partner@pin.md" className="ionix-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Parolă</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minim 8 caractere" className="ionix-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Prenume</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Ion" className="ionix-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Nume</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Popescu" className="ionix-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Denumire Companie</label>
                <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="iHouse SRL" className="ionix-input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Rată Comision (%)</label>
                <input type="number" step="0.5" min="0" max="100" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: parseFloat(e.target.value) })} className="ionix-input font-mono text-right" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={isPending} className="btn-primary">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Creează Cont
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Anulează</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Users table ──────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-white/8 rounded-lg" />)}
          </div>
        ) : (
          <table className="ionix-table">
            <thead>
              <tr>
                <th>Utilizator</th>
                <th>Companie</th>
                <th>Rol</th>
                <th>Comision</th>
                <th>Status</th>
                <th>Creat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium text-white">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-white/35">{u.email}</div>
                  </td>
                  <td className="text-white/60">{u.partner?.companyName ?? '—'}</td>
                  <td>
                    <span className={`badge text-xs ${u.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="font-mono text-white/60">{u.partner?.commissionRate ?? 0}%</td>
                  <td>
                    <span className={`badge text-xs ${u.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {u.isActive ? 'Activ' : 'Inactiv'}
                    </span>
                  </td>
                  <td className="text-white/40 text-xs">{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleUser({ id: u.id, isActive: !u.isActive })}
                        className={`btn-ghost px-2 py-1.5 ${u.isActive ? 'text-yellow-400/70 hover:text-yellow-400' : 'text-green-400/70 hover:text-green-400'}`}
                        title={u.isActive ? 'Dezactivează' : 'Activează'}
                      >
                        {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { if (confirm('Sigur vrei să ștergi acest utilizator?')) deleteUser(u.id); }}
                        className="btn-ghost px-2 py-1.5 text-red-400/50 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
