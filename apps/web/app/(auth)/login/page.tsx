'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, User, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  credential: z.string().min(2, 'Introduceți email-ul sau username-ul'),
  password: z.string().min(6, 'Parola trebuie să aibă cel puțin 6 caractere'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setMounted(true), []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      await login(data.credential, data.password);
      router.push(callbackUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Credențiale invalide');
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background blobs — adapts per theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full"
          style={{ background: isDark
            ? 'radial-gradient(circle, rgba(34,219,128,0.18) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)'
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full"
          style={{ background: isDark
            ? 'radial-gradient(circle, rgba(34,219,128,0.10) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(30,58,95,0.08) 0%, transparent 70%)'
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, delay: 1 }}
        />
      </div>

      {/* Theme toggle — top right */}
      {mounted && (
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="absolute top-5 right-5 z-20 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-medium"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.80)',
            color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(17,24,39,0.75)',
            backdropFilter: 'blur(8px)',
          }}
          title={isDark ? 'Temă deschisă' : 'Temă întunecată'}
        >
          {isDark
            ? <><Sun className="w-4 h-4 text-yellow-400" /><span>Deschis</span></>
            : <><Moon className="w-4 h-4 text-blue-600" /><span>Întunecat</span></>
          }
        </button>
      )}

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            className="flex flex-col items-center gap-2 mb-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            {/* mounted guard prevents wrong logo/colors on first render */}
            {mounted ? (
              <Image
                src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
                alt="Ionix Partner"
                width={297}
                height={72}
                className="h-[135px] w-auto"
                priority
              />
            ) : (
              <div className="h-[135px]" />
            )}

            {mounted ? (
              <div
                className="text-xs font-medium tracking-widest uppercase"
                style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(30,58,95,0.50)' }}
              >
                OCN „Priminvestnord" SRL
              </div>
            ) : (
              <div className="h-4" />
            )}
          </motion.div>

          {mounted ? (
            <p
              className="text-sm"
              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,24,39,0.50)' }}
            >
              Autentificați-vă în portalul parteneri
            </p>
          ) : (
            <div className="h-5" />
          )}
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Credential */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Email sau Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  {...register('credential')}
                  type="text"
                  placeholder="exemplu@pin.md sau username"
                  className="ionix-input pl-10"
                  autoComplete="username"
                />
              </div>
              {errors.credential && <p className="text-xs text-red-400">{errors.credential.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Parolă</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="ionix-input pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2 h-11">
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Se autentifică...</>
              ) : (
                <>Accesați portalul<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {mounted && (
          <div className="text-center mt-6 space-y-1.5">
            <p
              className="text-xs"
              style={{ color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(17,24,39,0.30)' }}
            >
              Portal privat — Acces restricționat partenerilor autorizați
            </p>
            <p
              className="text-xs"
              style={{ color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.25)' }}
            >
              Elaborat de{' '}
              <a
                href="https://t.me/SysAdmin_Pin"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: isDark ? 'rgba(34,219,128,0.55)' : 'rgba(37,99,235,0.55)' }}
              >
                Bajerean Ion
              </a>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
