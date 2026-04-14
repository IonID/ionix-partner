'use client';

// Minimal toast hook (compatible with Radix Toast / shadcn pattern)
import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastFn: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function useToast() {
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    if (toastFn) toastFn(t);
    else console.warn('Toast:', t.title, t.description);
  }, []);

  return { toast };
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  toastFn = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  };

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, dismiss };
}
