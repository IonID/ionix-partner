'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calculator, FileText, Users,
  Settings, LogOut, ChevronRight, Building2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { PartnerAvatar } from '@/components/PartnerAvatar';

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
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const navItems = user?.role === 'ADMIN' ? adminNav : partnerNav;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r border-white/8 relative">
      {/* Subtle sidebar background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/3 to-transparent pointer-events-none" />

      <div className="flex flex-col h-full relative z-10">
        {/* ── Logo ─────────────────────────────────────────── */}
        <div className="flex items-center px-5 py-4 border-b border-white/8">
          <Image
            src="/icon.svg"
            alt="Ionix Partner"
            width={48}
            height={48}
            className="w-12 h-12"
            priority
          />
        </div>

        {/* ── User info ──────────────────────────────────────── */}
        {user && (
          <div className="mx-3 mt-4 mb-2 rounded-lg p-3 bg-white/5 border border-white/8">
            <div className="flex items-center gap-2.5">
              <PartnerAvatar
                logoPath={(user as any).partner?.logoPath}
                companyName={user.partner?.companyName}
                size="sm"
              />
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
            © {new Date().getFullYear()} Priminvestnord SRL
          </p>
        </div>
      </div>
    </aside>
  );
}
