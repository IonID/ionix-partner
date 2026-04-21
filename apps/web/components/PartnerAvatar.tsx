'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/uploads`
  : '/uploads-proxy';

const SIZES = {
  sm:  'w-7 h-7 text-[10px]',
  md:  'w-9 h-9 text-xs',
  lg:  'w-12 h-12 text-sm',
};

interface PartnerAvatarProps {
  logoPath?: string | null;
  companyName?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PartnerAvatar({
  logoPath,
  companyName,
  size = 'md',
  className = '',
}: PartnerAvatarProps) {
  const sizeClass = SIZES[size];

  if (logoPath) {
    return (
      <div className={`${sizeClass} rounded-lg overflow-hidden flex-shrink-0 bg-white/5 ${className}`}>
        <img
          src={`${API_BASE}/${logoPath}`}
          alt={companyName ?? 'Logo partener'}
          className="w-full h-full object-contain p-0.5"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            if (img.parentElement) {
              img.parentElement.innerHTML = fallbackHtml(companyName);
            }
          }}
        />
      </div>
    );
  }

  // Neutral placeholder (no color, no initials — just a building icon)
  return (
    <div className={`${sizeClass} rounded-lg flex-shrink-0 flex items-center justify-center bg-slate-700/50 border border-white/10 ${className}`}>
      <svg viewBox="0 0 16 16" fill="none" className="w-3/5 h-3/5 opacity-40">
        <rect x="2" y="6" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" className="text-slate-300" />
        <path d="M5 15V11h6v4" stroke="currentColor" strokeWidth="1.2" className="text-slate-300" />
        <path d="M6 3l2-2 2 2" stroke="currentColor" strokeWidth="1.2" className="text-slate-300" />
      </svg>
    </div>
  );
}

function fallbackHtml(name?: string | null): string {
  return `<div class="w-full h-full flex items-center justify-center bg-slate-700/50">
    <svg viewBox="0 0 16 16" fill="none" class="w-3/5 h-3/5 opacity-40">
      <rect x="2" y="6" width="12" height="9" rx="1" stroke="#94a3b8" stroke-width="1.2"/>
      <path d="M5 15V11h6v4" stroke="#94a3b8" stroke-width="1.2"/>
      <path d="M6 3l2-2 2 2" stroke="#94a3b8" stroke-width="1.2"/>
    </svg>
  </div>`;
}
