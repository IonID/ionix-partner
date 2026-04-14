'use client';

import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/8">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/45 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-white/8 transition-colors text-white/50 hover:text-white">
          <Bell className="w-4 h-4" />
        </button>

        <div className="h-8 w-px bg-white/10" />

        <div className="text-right">
          <div className="text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </div>
          <div className="text-xs text-white/40">{user?.email}</div>
        </div>
      </div>
    </header>
  );
}
