'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { formatMDL, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const statusConfig = {
  PENDING:    { label: 'În așteptare',  badge: 'badge-yellow', icon: Clock },
  PROCESSING: { label: 'În procesare', badge: 'badge-blue',   icon: Clock },
  APPROVED:   { label: 'Aprobat',      badge: 'badge-green',  icon: CheckCircle },
  REJECTED:   { label: 'Respins',      badge: 'badge-red',    icon: XCircle },
  CANCELLED:  { label: 'Anulat',       badge: 'badge-gray',   icon: XCircle },
};

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page],
    queryFn: () => api.get(`/applications?page=${page}&limit=20`).then((r) => r.data.data),
  });

  const apps = data?.data ?? [];
  const filtered = apps.filter((a: any) =>
    search === '' ||
    `${a.clientFirstName} ${a.clientLastName}`.toLowerCase().includes(search.toLowerCase()) ||
    a.clientIdnp?.includes(search),
  );

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
        <Link href="/applications/new" className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Cerere Nouă
        </Link>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
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
                  {user?.role === 'ADMIN' && <th>Partener</th>}
                  <th>Tip Credit</th>
                  <th>Sumă</th>
                  <th>Termen</th>
                  <th>Rată / lună</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app: any, i: number) => {
                  const sc = statusConfig[app.status as keyof typeof statusConfig];
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
                        {sc && (
                          <span className={`badge text-xs ${sc.badge}`}>
                            {sc.label}
                          </span>
                        )}
                      </td>
                      <td className="text-white/40 text-xs">{formatDate(app.createdAt)}</td>
                      <td>
                        <Link href={`/applications/${app.id}`} className="btn-ghost px-2 py-1.5">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-white/30">
                      {search ? 'Niciun rezultat pentru căutare' : 'Nu există cereri încă'}
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
            <span className="text-xs text-white/40">
              {data.total} cereri totale
            </span>
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
