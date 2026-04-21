'use client';

import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={theme === 'dark' ? 'Temă deschisă' : 'Temă întunecată'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        <button className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
        </button>

        <div className="h-8 w-px bg-border" />

        <div className="text-right">
          <div className="text-sm font-medium">{user?.firstName} {user?.lastName}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </div>
      </div>
    </header>
  );
}
