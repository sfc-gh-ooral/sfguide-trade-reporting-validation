import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';

// next/font downloads these OFL fonts at build time and serves them from the app; no CDN at runtime.
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap' });
const plexCond = IBM_Plex_Sans_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-plex-cond', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Cadrel reporting desk · Regulatory Trade Reporting Validation (Snowflake example)',
  description: 'Catch CAT and CAIS reporting errors before submission, reconcile against the books, and work regulator rejects faster. Synthetic data.',
};
export const viewport: Viewport = { themeColor: '#0B0E13' };

// Sets the saved theme before first paint so the page doesn't flash.
const THEME = `try{var t=localStorage.getItem('trv-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${plex.variable} ${plexCond.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
