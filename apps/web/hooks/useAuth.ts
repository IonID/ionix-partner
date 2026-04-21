'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, setCookieValue, deleteCookie } from '@/lib/api';

interface User {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'VIEWER' | 'PARTNER_ADMIN' | 'PARTNER' | 'MANAGER';
  partner?: { id: string; companyName: string; logoPath: string | null } | null;
}

let globalUser: User | null = null;
const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach((fn) => fn());
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(globalUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => setUser(globalUser);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  const login = useCallback(async (credential: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { credential, password });
      const { accessToken, user: u } = data.data;

      setCookieValue('accessToken', accessToken, 15);

      globalUser = u;
      notifyAll();

      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    deleteCookie('accessToken');
    globalUser = null;
    notifyAll();
  }, []);

  // ── Fetch current user (on mount, if token exists) ─────────────
  const fetchMe = useCallback(async () => {
    if (globalUser) return;
    try {
      const { data } = await api.get('/auth/me');
      globalUser = data.data;
      notifyAll();
    } catch {
      globalUser = null;
      notifyAll();
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, []);

  return { user, loading, login, logout, fetchMe };
}
