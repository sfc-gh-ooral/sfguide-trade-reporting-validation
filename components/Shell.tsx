'use client';

// App frame: top navigation with the Cadrel brand, environment badge (Sample/Live switch), role chip and
// theme toggle; a deadline strip on every screen; the hosted-example notice; and the disclaimer footer.
import { Activity, AlarmClock, FileCheck2, Gauge, ListChecks, Menu, Moon, Sun, UserRound, Users, Wrench, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { countdown, dayLong, stamp } from '@/components/fmt';
import { Wordmark } from '@/components/Logo';
import { ModeChip } from '@/components/ModeChip';
import { tradingDaysAfter } from '@/lib/build';
import { data } from '@/lib/client';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import type { Health } from '@/lib/types';

const REPO = 'https://github.com/sfc-gh-ooral/sfguide-trade-reporting-validation';
const NAV = [
  { href: '/', label: 'Health', icon: Gauge },
  { href: '/checks', label: 'Checks', icon: ListChecks },
  { href: '/rejects', label: 'Rejects', icon: Wrench },
  { href: '/cais', label: 'CAIS', icon: Users },
  { href: '/anomalies', label: 'Anomalies', icon: Activity },
  { href: '/evidence', label: 'Evidence', icon: FileCheck2 },
];

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.dataset.theme === 'light'); }, []);
  const flip = () => {
    const next = !light; setLight(next);
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    localStorage.setItem('trv-theme', next ? 'light' : 'dark');
  };
  return (
    <button className="btn btn-sm !px-2" onClick={flip} aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} title="Theme">
      {light ? <Moon className="w-3.5 h-3.5" aria-hidden /> : <Sun className="w-3.5 h-3.5" aria-hidden />}
    </button>
  );
}

/** Business clock and the two deadlines that matter, like a departures board. */
function DeadlineStrip() {
  const [h, setH] = useState<Health>();
  useEffect(() => { data.health().then(setH, () => undefined); }, []);
  if (!h) return <div className="h-10 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }} aria-hidden />;
  const asOfDate = h.asOf.slice(0, 10);
  const nextFileDue = `${tradingDaysAfter(asOfDate, 1)}T08:00:00`;
  const cells: { label: string; value: string; sub: string; tone?: string }[] = [
    { label: 'Business clock', value: stamp(h.asOf), sub: 'synthetic data set, frozen' },
    { label: `CAT file · trade date ${asOfDate.slice(5)}`, value: countdown(h.asOf, nextFileDue), sub: `due ${stamp(nextFileDue)}` },
  ];
  if (h.deadline) cells.push({ label: `Repairs due · trade date ${h.deadline.tradeDate.slice(5)}`, value: countdown(h.asOf, h.deadline.due), sub: `${h.deadline.open} open · ${stamp(h.deadline.due)}`, tone: 'var(--signal)' });
  return (
    <div className="border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 flex items-stretch overflow-x-auto scroller">
        <div className="flex items-center gap-2 pr-4 py-2 shrink-0"><AlarmClock className="w-4 h-4" style={{ color: 'var(--signal)' }} aria-hidden /><span className="eyebrow">Deadlines</span></div>
        {cells.map((c) => (
          <div key={c.label} className="flex items-center gap-3 px-4 py-2 border-l shrink-0" style={{ borderColor: 'var(--line)' }} title={c.sub}>
            <span className="text-[11px] muted">{c.label}</span>
            <span className="mono text-[13px] font-semibold" style={{ color: c.tone ?? 'var(--text)' }}>{c.value}</span>
            <span className="text-[11px] muted hidden lg:inline">{c.sub}</span>
          </div>
        ))}
        <div className="ml-auto hidden md:flex items-center pl-4 text-[11px] muted shrink-0">Trade date {dayLong(h.latestTradeDate)}</div>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/checks' && pathname.startsWith('/order')));

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn">Skip to content</a>
      {HOSTED_EXAMPLE && (
        <div className="text-[12px] text-center px-3 py-1.5" style={{ background: 'color-mix(in srgb, var(--signal) 14%, var(--bg))', color: 'var(--text)' }}>
          <strong>Hosted example in Sample mode.</strong> Runs in your browser on synthetic data; AI answers were captured from a live run.{' '}
          <a className="underline" href={`${REPO}#live-mode-deploy-to-your-account`}>Run it live in your account</a>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}>
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-[52px] flex items-center gap-3">
          <Link href="/" className="no-underline shrink-0" aria-label="Cadrel reporting desk, home"><Wordmark /></Link>
          <nav aria-label="Main" className="hidden lg:flex items-center ml-4">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="navtab" aria-current={active(href) ? 'page' : undefined}><Icon className="w-4 h-4" aria-hidden />{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline-flex pill" style={{ color: 'var(--text-2)', background: 'var(--surface-2)', borderColor: 'var(--line)' }} title="Persona and the Snowflake role Live mode uses">
              <UserRound className="w-3 h-3" aria-hidden />Reporting analyst · <span className="mono">TRV_DEMO_ROLE</span>
            </span>
            <ModeChip />
            <ThemeToggle />
            <button ref={toggleRef} className="btn btn-sm !px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav"><Menu className="w-4 h-4" aria-hidden /></button>
          </div>
        </div>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/55" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
          <nav id="mobile-nav" aria-label="Main" className="drawer absolute right-0 top-0 h-full w-72 max-w-[85vw] p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between mb-3"><Wordmark /><button autoFocus className="btn btn-sm !px-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="w-4 h-4" aria-hidden /></button></div>
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active(href) ? 'page' : undefined}
                className="flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium no-underline"
                style={active(href) ? { background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--text)' } : { color: 'var(--text-2)' }}>
                <Icon className="w-4 h-4" aria-hidden />{label}
              </Link>
            ))}
            <div className="mt-auto text-[11px] muted">Reporting analyst · TRV_DEMO_ROLE</div>
          </nav>
        </div>
      )}
      <DeadlineStrip />
      <main id="main" className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-6 min-w-0">{children}</main>
      <footer className="border-t" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 text-[11.5px] muted flex flex-wrap gap-x-6 gap-y-1">
          <span>Cadrel is a fictional product; Northwind Securities is a fictional firm. Synthetic data only.</span>
          <span>Schemas and error codes are illustrative, not the official CAT or CAIS specifications. Not production, regulatory or compliance advice.</span>
          <span>AI suggestions need a person&apos;s approval. <a className="underline" href={REPO}>Repository</a></span>
        </div>
      </footer>
    </div>
  );
}
