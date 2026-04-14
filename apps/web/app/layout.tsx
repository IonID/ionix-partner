import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: { default: 'Ionix Partner', template: '%s — Ionix Partner' },
  description: 'Portal B2B pentru Parteneri — Priminvestnord',
  robots: 'noindex, nofollow',  // private portal — do not index
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
