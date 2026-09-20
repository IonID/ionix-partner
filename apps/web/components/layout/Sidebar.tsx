'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calculator, FileText, Users,
  Settings, LogOut, ChevronRight, Building2, Menu, X, Database
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { PartnerAvatar } from '@/components/PartnerAvatar';
import { IonixLogo } from '@/components/IonixLogo';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';

const partnerNav = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/calculator',    icon: Calculator,       label: 'Calculator'  },
  { href: '/applications',  icon: FileText,         label: 'Cereri'      },
];

const adminNav = [
  { href: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/applications',     icon: FileText,        label: 'Toate Cererile' },
  { href: '/admin/users',      icon: Users,           label: 'Parteneri'  },
  { href: '/admin/settings',   icon: Settings,        label: 'Setări Globale' },
  { href: '/admin/backups',    icon: Database,        label: 'Copii de rezervă' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Închide sidebar-ul la schimbarea rutei (mobil)
  useEffect(() => { setIsOpen(false); }, [pathname]);

  const navItems = user?.role === 'ADMIN' ? adminNav : partnerNav;

  const handleLogout = async () => {
    await logout();
    router.refresh();
    router.push('/login');
  };

  return (
    <>
      {/* ── Buton hamburger (doar mobil) ───────────────────────────────── */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-background border border-white/10 shadow-lg"
        onClick={() => setIsOpen(true)}
        aria-label="Deschide meniu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Backdrop (doar mobil, când sidebar-ul e deschis) ───────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'flex flex-col w-64 border-r border-white/8 bg-background',
          // Mobile: drawer fixed cu tranziție slide
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static în flow, mereu vizibil
          'md:relative md:static md:translate-x-0 md:min-h-screen md:z-auto',
        )}
      >
      {/* Subtle sidebar background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/3 to-transparent pointer-events-none" />

      <div className="flex flex-col h-full relative z-10">
        {/* ── Logo ─────────────────────────────────────────── */}
        <div className="flex items-center px-5 py-4 border-b border-white/8">
          {mounted && (
            <IonixLogo variant={theme === 'light' ? 'light' : 'dark'} className="h-[54px] w-auto" />
          )}
        </div>

        {/* ── User info ──────────────────────────────────────── */}
        {user && (
          <div className="mx-3 mt-4 mb-2 rounded-lg p-3 bg-white/5 border border-white/8">
            <div className="flex items-center gap-2.5">
              {user.role === 'ADMIN' ? (
                <div className="w-[42px] h-[42px] rounded-lg flex-shrink-0 flex items-center justify-center bg-white/5 border border-white/8">
                  <Image src="/icon.svg" alt="Ionix" width={28} height={28} className="w-7 h-7" />
                </div>
              ) : (
                <PartnerAvatar
                  logoPath={(user as any).partner?.logoPath}
                  companyName={user.partner?.companyName}
                  size="xl"
                />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {user.firstName} {user.lastName}
                </div>
                {user.partner?.companyName && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[10px] text-slate-400 truncate">{user.partner.companyName}</span>
                  </div>
                )}
                {user.role === 'ADMIN' && (
                  <span className="text-[10px] text-blue-400/80 font-medium">Administrator</span>
                )}
                {user.role === 'MANAGER' && (
                  <span className="text-[10px] text-purple-400/80 font-medium">Manager</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn('nav-item', isActive && 'active')}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom: Logout ─────────────────────────────────── */}
        <div className="px-3 py-4 border-t border-white/8">
          <button
            onClick={handleLogout}
            className="nav-item w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/8"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Deconectare</span>
          </button>
        </div>

        {/* ── Footer credit (obligatoriu) ─────────────────────── */}
        <div className="px-5 pb-4">
          <p className="text-[10px] text-white/20 leading-relaxed">
            <span className="text-[12.5px] text-white/35 font-medium">Elaborat de @Bajerean Ion</span>
            <br />
            © {new Date().getFullYear()} Bug Fix Group SRL
          </p>
        </div>
      </div>

      {/* ── Buton închidere (doar mobil, în interiorul drawer-ului) ───── */}
      <button
        className="absolute top-4 right-4 md:hidden p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/80 transition-colors"
        onClick={() => setIsOpen(false)}
        aria-label="Închide meniu"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
    </>
  );
}
