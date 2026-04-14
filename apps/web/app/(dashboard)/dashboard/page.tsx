'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, DollarSign, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatMDL, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const statusConfig = {
  PENDING:    { label: 'În așteptare',  color: 'badge-yellow', icon: Clock },
  PROCESSING: { label: 'În procesare', color: 'badge-blue',   icon: Clock },
  APPROVED:   { label: 'Aprobat',      color: 'badge-green',  icon: CheckCircle },
  REJECTED:   { label: 'Respins',      color: 'badge-red',    icon: XCircle },
  CANCELLED:  { label: 'Anulat',       color: 'badge-gray',   icon: XCircle },
};

function StatCard({ icon: Icon, label, value, sub, color = 'text-white' }: any) {
  return (
    <motion.div className="stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-400" />
        </div>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-white/35">{sub}</p>}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <Header title="Dashboard" />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="h-3 bg-white/10 rounded w-24 mb-3" />
              <div className="h-8 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Header
        title={`Bun venit, ${user?.firstName}!`}
        subtitle={isAdmin ? 'Panou de administrare' : `Partener: ${user?.partner?.companyName}`}
      />

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin ? (
          <>
            <StatCard icon={Users}     label="Parteneri activi"   value={stats?.overview?.totalPartners ?? 0} />
            <StatCard icon={FileText}  label="Total cereri"       value={stats?.overview?.totalApplications ?? 0} />
            <StatCard icon={TrendingUp} label="Cereri luna aceasta" value={stats?.overview?.monthApplications ?? 0} color="text-brand-400" />
            <StatCard icon={CheckCircle} label="Aprobate" value={stats?.statusBreakdown?.APPROVED ?? 0} color="text-green-400" />
          </>
        ) : (
          <>
            <StatCard icon={FileText}  label="Cereri luna aceasta" value={stats?.overview?.monthApplications ?? 0} color="text-brand-400" />
            <StatCard icon={TrendingUp} label="Total cereri"       value={stats?.overview?.totalApplications ?? 0} />
            <StatCard icon={DollarSign} label="Comision aprobat (luna)" value={formatMDL(stats?.overview?.monthlyCommission ?? 0)} color="text-green-400" sub={`Rată: ${stats?.overview?.commissionRate ?? 0}%`} />
            <StatCard icon={CheckCircle} label="Rata comision"     value={`${stats?.overview?.commissionRate ?? 0}%`} />
          </>
        )}
      </div>

      {/* ── Charts + Recent applications ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Volume chart */}
        <div className="glass-card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-white mb-4">Volum cereri — ultimele 6 luni</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats?.monthlyVolume ?? []} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#1a1e2c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                itemStyle={{ color: '#22DB80' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {(stats?.monthlyVolume ?? []).map((_: any, i: number) => (
                  <Cell key={i} fill={i === (stats.monthlyVolume.length - 1) ? '#22DB80' : 'rgba(34,219,128,0.3)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Status cereri</h2>
          <div className="space-y-2.5">
            {Object.entries(statusConfig).map(([key, cfg]) => {
              const count = stats?.statusBreakdown?.[key] ?? 0;
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs text-white/60">{cfg.label}</span>
                  </div>
                  <span className={`badge text-xs ${cfg.color}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Recent applications ───────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Cereri recente</h2>
        <div className="overflow-x-auto">
          <table className="ionix-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Tip</th>
                <th>Sumă</th>
                <th>Rată / lună</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentApplications ?? []).map((app: any) => {
                const sc = statusConfig[app.status as keyof typeof statusConfig];
                return (
                  <tr key={app.id}>
                    <td className="font-medium text-white">{app.clientFirstName} {app.clientLastName}</td>
                    <td>
                      <span className={`badge text-xs ${app.creditType === 'ZERO' ? 'badge-green' : 'badge-blue'}`}>
                        {app.creditType === 'ZERO' ? 'Credit Zero' : 'Credit Clasic'}
                      </span>
                    </td>
                    <td className="font-mono text-white/80">{formatMDL(app.amount)}</td>
                    <td className="font-mono text-brand-400">{formatMDL(app.monthlyPayment)}/lună</td>
                    <td><span className={`badge text-xs ${sc?.color ?? 'badge-gray'}`}>{sc?.label ?? app.status}</span></td>
                    <td className="text-white/40">{formatDate(app.createdAt)}</td>
                  </tr>
                );
              })}
              {!stats?.recentApplications?.length && (
                <tr><td colSpan={6} className="text-center text-white/30 py-8">Nu există cereri recente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
