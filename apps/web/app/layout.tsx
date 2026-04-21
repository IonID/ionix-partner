import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: { default: 'Ionix Partner', template: '%s — Ionix Partner' },
  description: 'Portal B2B pentru Parteneri — Priminvestnord',
  robots: 'noindex, nofollow',
  icons: {
    icon: [
      { url: '/favicon-16.png',  sizes: '16x16',  type: 'image/png' },
      { url: '/favicon-32.png',  sizes: '32x32',  type: 'image/png' },
      { url: '/favicon-48.png',  sizes: '48x48',  type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg',        type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
  },
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
