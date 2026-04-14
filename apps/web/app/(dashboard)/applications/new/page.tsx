'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Phone, Mail, CreditCard, Upload, Send, Loader2, ArrowLeft, ImageIcon, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const schema = z.object({
  clientFirstName: z.string().min(2, 'Prenumele este obligatoriu'),
  clientLastName:  z.string().min(2, 'Numele este obligatoriu'),
  clientIdnp:      z.string().length(13, 'IDNP trebuie să aibă exact 13 cifre').regex(/^\d+$/, 'IDNP conține doar cifre'),
  clientPhone:     z.string().min(8, 'Telefonul este obligatoriu'),
  clientEmail:     z.string().email('Email invalid').optional().or(z.literal('')),
  clientAddress:   z.string().optional(),
  creditType:      z.enum(['ZERO', 'CLASSIC']),
  amount:          z.number().positive().max(100000),
  months:          z.number().int().min(1).max(60),
});
type FormData = z.infer<typeof schema>;

function FileUploadZone({ label, name, preview, onChange }: { label: string; name: string; preview: string | null; onChange: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/3 hover:border-brand-500/40 hover:bg-brand-500/5 cursor-pointer transition-all p-4 min-h-[120px]"
    >
      <input ref={ref} type="file" name={name} accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
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
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<{ idFront?: File; idBack?: File; selfie?: File }>({});
  const [previews, setPreviews] = useState<{ idFront?: string; idBack?: string; selfie?: string }>({});

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { creditType: 'CLASSIC', amount: 5000, months: 12 },
  });

  const setFile = (field: 'idFront' | 'idBack' | 'selfie', file: File) => {
    setFiles((p) => ({ ...p, [field]: file }));
    const url = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [field]: url }));
  };

  const onSubmit = async (data: FormData) => {
    if (!files.idFront) {
      toast({ title: 'Document lipsă', description: 'Foto față buletin este obligatorie', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
      if (files.idFront) formData.append('idFront', files.idFront);
      if (files.idBack)  formData.append('idBack',  files.idBack);
      if (files.selfie)  formData.append('selfie',  files.selfie);

      await api.post('/applications', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

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
      <Header title="Cerere Nouă de Credit" subtitle="Completați datele clientului și alegeți tipul creditului" />

      <button onClick={() => router.back()} className="btn-ghost text-sm">
        <ArrowLeft className="w-4 h-4" /> Înapoi
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
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-white/50">IDNP *</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input {...register('clientIdnp')} placeholder="2001234567890" className="ionix-input pl-9 font-mono" maxLength={13} />
                </div>
                {errors.clientIdnp && <p className="text-xs text-red-400">{errors.clientIdnp.message}</p>}
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
                <label className="text-xs text-white/50">Email (opțional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input {...register('clientEmail')} placeholder="client@exemplu.md" className="ionix-input pl-9" />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-white/50">Adresă (opțional)</label>
                <input {...register('clientAddress')} placeholder="Chișinău, str. Exemplu 1" className="ionix-input" />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand-400" /> Documente Client
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <FileUploadZone label="Față buletin *" name="idFront" preview={previews.idFront ?? null} onChange={(f) => setFile('idFront', f)} />
              <FileUploadZone label="Verso buletin" name="idBack" preview={previews.idBack ?? null} onChange={(f) => setFile('idBack', f)} />
              <FileUploadZone label="Selfie cu buletinul" name="selfie" preview={previews.selfie ?? null} onChange={(f) => setFile('selfie', f)} />
            </div>
            <p className="text-xs text-white/25 mt-2">Format acceptat: JPEG, PNG, PDF. Max 10 MB per fișier.</p>
          </div>
        </div>

        {/* ── Credit parameters ─────────────────────────────── */}
        <div className="space-y-5">
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Parametri Credit</h2>

            <div className="space-y-4">
              {/* Credit type */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Tip Credit</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ZERO', 'CLASSIC'] as const).map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => setValue('creditType', t)}
                      className={`py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                        watch('creditType') === t
                          ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      {t === 'ZERO' ? '🟢 Credit Zero' : '🔵 Credit Clasic'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Suma (MDL)</label>
                <input
                  type="number"
                  {...register('amount', { valueAsNumber: true })}
                  className="ionix-input font-mono text-right"
                  min={500} max={50000} step={500}
                />
                {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
              </div>

              {/* Months */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Termen (luni)</label>
                <select {...register('months', { valueAsNumber: true })} className="ionix-input">
                  {[3, 6, 9, 12, 15, 18, 24].map((m) => (
                    <option key={m} value={m}>{m} luni</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
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

          <p className="text-xs text-white/25 text-center">
            Cererea va fi transmisă automat operatorilor prin Telegram
          </p>
        </div>
      </form>
    </div>
  );
}
