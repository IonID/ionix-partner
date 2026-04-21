'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  User, Phone, Upload, Send, Loader2, ArrowLeft,
  ImageIcon, ShoppingBag, Lock, Calculator,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { formatMDL } from '@/lib/utils';

const schema = z.object({
  clientFirstName: z.string().min(2, 'Prenumele este obligatoriu'),
  clientLastName:  z.string().min(2, 'Numele este obligatoriu'),
  clientPhone:     z.string().min(8, 'Telefonul este obligatoriu'),
  clientProduct:   z.string().min(2, 'Denumirea produsului este obligatorie'),
});
type FormData = z.infer<typeof schema>;

function FileUploadZone({ label, preview, onChange }: { label: string; preview: string | null; onChange: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/3 hover:border-brand-500/40 hover:bg-brand-500/5 cursor-pointer transition-all p-4 min-h-[120px]"
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
      {preview ? (
        <img src={preview} alt={label} className="max-h-24 rounded-lg object-cover" />
      ) : (
        <>
          <ImageIcon className="w-8 h-8 text-white/20" />
          <span className="text-xs text-white/40 text-center">{label}</span>
          <span className="text-[10px] text-white/25">Apasă pentru a alege</span>
        </>
      )}
    </div>
  );
}

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<{ idFront?: File; idBack?: File; selfie?: File }>({});
  const [previews, setPreviews] = useState<{ idFront?: string; idBack?: string; selfie?: string }>({});

  // Credit params passed from Calculator — required to reach this page
  const paramAmount     = searchParams.get('amount');
  const paramMonths     = searchParams.get('months');
  const paramCreditType = searchParams.get('creditType');
  const hasCalcData     = !!(paramAmount && paramMonths && paramCreditType);

  // Redirect to calculator if accessed without data
  if (!hasCalcData) {
    router.replace('/calculator');
    return null;
  }

  const amount     = Number(paramAmount);
  const months     = Number(paramMonths);
  const creditType = paramCreditType as 'ZERO' | 'CLASSIC';

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const setFile = (field: 'idFront' | 'idBack' | 'selfie', file: File) => {
    setFiles((p) => ({ ...p, [field]: file }));
    setPreviews((p) => ({ ...p, [field]: URL.createObjectURL(file) }));
  };

  const onSubmit = async (data: FormData) => {
    if (!files.idFront) {
      toast({ title: 'Document lipsă', description: 'Foto față buletin este obligatorie', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('clientFirstName', data.clientFirstName);
      formData.append('clientLastName',  data.clientLastName);
      formData.append('clientPhone',     data.clientPhone);
      formData.append('clientProduct',   data.clientProduct);
      formData.append('creditType',      creditType);
      formData.append('amount',          String(amount));
      formData.append('months',          String(months));
      if (files.idFront) formData.append('idFront', files.idFront);
      if (files.idBack)  formData.append('idBack',  files.idBack);
      if (files.selfie)  formData.append('selfie',  files.selfie);

      await api.post('/applications', formData);
      toast({ title: 'Cerere trimisă!', description: 'Cererea a fost transmisă cu succes.' });
      router.push('/applications');
    } catch (err: any) {
      toast({ title: 'Eroare', description: err?.response?.data?.message ?? 'Nu s-a putut trimite cererea', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <Header title="Cerere Nouă de Credit" subtitle="Completați datele clientului" />

      <button onClick={() => router.back()} className="btn-ghost text-sm">
        <ArrowLeft className="w-4 h-4" /> Înapoi la Calculator
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Client data ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-400" /> Date Client
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Prenume *</label>
                <input {...register('clientFirstName')} placeholder="Ion" className="ionix-input" />
                {errors.clientFirstName && <p className="text-xs text-red-400">{errors.clientFirstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Nume *</label>
                <input {...register('clientLastName')} placeholder="Popescu" className="ionix-input" />
                {errors.clientLastName && <p className="text-xs text-red-400">{errors.clientLastName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Telefon *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input {...register('clientPhone')} placeholder="+37369000000" className="ionix-input pl-9" />
                </div>
                {errors.clientPhone && <p className="text-xs text-red-400">{errors.clientPhone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Denumire Produs *</label>
                <div className="relative">
                  <ShoppingBag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input {...register('clientProduct')} placeholder="ex: Laptop Lenovo" className="ionix-input pl-9" />
                </div>
                {errors.clientProduct && <p className="text-xs text-red-400">{errors.clientProduct.message}</p>}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-400" /> Documente Client
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <FileUploadZone label="Față buletin *" preview={previews.idFront ?? null} onChange={(f) => setFile('idFront', f)} />
              <FileUploadZone label="Verso buletin"  preview={previews.idBack  ?? null} onChange={(f) => setFile('idBack',  f)} />
              <FileUploadZone label="Selfie cu buletinul" preview={previews.selfie ?? null} onChange={(f) => setFile('selfie', f)} />
            </div>
            <p className="text-xs text-white/25 mt-2">Format acceptat: JPEG, PNG, PDF. Max 10 MB per fișier.</p>
          </div>
        </div>

        {/* ── Credit params (read-only from Calculator) ─────── */}
        <div className="space-y-5">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-3.5 h-3.5 text-white/40" />
              <h2 className="text-sm font-semibold text-white">Parametri Credit</h2>
            </div>
            <p className="text-xs text-white/35 mb-4">
              Valorile preluate din Calculator. Pentru modificare,{' '}
              <a href="/calculator" className="text-brand-400 hover:underline">revino la Calculator</a>.
            </p>

            <div className="space-y-3">
              <div className="rounded-lg bg-white/4 border border-white/8 px-4 py-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Tip Credit</p>
                <p className="text-sm font-semibold text-white">
                  {creditType === 'ZERO' ? '🟢 Credit Zero' : '🔵 Credit Clasic'}
                </p>
              </div>
              <div className="rounded-lg bg-white/4 border border-white/8 px-4 py-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Suma</p>
                <p className="text-base font-semibold font-mono text-brand-400">{formatMDL(amount)}</p>
              </div>
              <div className="rounded-lg bg-white/4 border border-white/8 px-4 py-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Termen</p>
                <p className="text-base font-semibold font-mono text-white">{months} luni</p>
              </div>
            </div>

            <a href="/calculator" className="btn-ghost w-full mt-4 text-sm border border-white/10 hover:border-brand-500/30">
              <Calculator className="w-4 h-4" />
              Modifică în Calculator
            </a>
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full h-12 text-base"
            whileTap={{ scale: 0.98 }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Se trimite...</>
            ) : (
              <><Send className="w-4 h-4" /> Trimite Cererea</>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
