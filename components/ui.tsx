'use client';

// Shared UI pieces: panels, KPI tiles, badges, skeletons, sortable tables, the detail drawer,
// streamed AI text, and a tiny markdown renderer for AI output (text is escaped by React).
import { ArrowDown, ArrowUp, ArrowUpDown, Bot, Database, Snowflake, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Provenance } from '@/lib/types';

export function Panel({ title, eyebrow, right, children, className = '', pad = true }: { title?: ReactNode; eyebrow?: string; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <div className="panel-head">
          <div className="min-w-0">{eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}{title && <h2 className="panel-title">{title}</h2>}</div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </div>
      )}
      <div className={pad ? 'p-4' : 'pt-3'}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="eyebrow mb-1">{eyebrow}</div>
        <h1 className="display text-[26px] sm:text-[30px] font-semibold leading-tight">{title}</h1>
        {sub && <p className="text-sm text-2 mt-1 max-w-3xl">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}

/** Counts up once to the target on first paint (skipped under reduced motion). */
export function CountUp({ value, format = (x) => Math.round(x).toLocaleString('en-US') }: { value: number; format?: (x: number) => string }) {
  const [v, setV] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    if (done.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    done.current = true;
    const t0 = performance.now(); const dur = 700;
    let id = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / dur); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) id = requestAnimationFrame(step); };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <>{format(v)}</>;
}

export function Spark({ values, labels, color = 'var(--ice)', highlightLast = true }: { values: number[]; labels?: string[]; color?: string; highlightLast?: boolean }) {
  const [hi, setHi] = useState<number>();
  if (values.length < 2) return null;
  const W = 120, H = 32, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pt = (v: number, i: number) => [(i / (values.length - 1)) * W, H - 3 - ((v - min) / Math.max(1, max - min)) * (H - 6)];
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${pt(v, i).map((x) => x.toFixed(1)).join(' ')}`).join('');
  const [lx, ly] = pt(values.at(-1)!, values.length - 1);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHi(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))));
  };
  const hx = hi == null ? 0 : (hi / (values.length - 1)) * 100;
  return (
    <div className="relative" onPointerMove={onMove} onPointerLeave={() => setHi(undefined)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none" aria-hidden>
        <path d={`${d}L${W} ${H}L0 ${H}Z`} fill={color} opacity={0.12} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        {highlightLast && hi == null && <circle cx={lx} cy={ly} r={2.6} fill={color} />}
        {hi != null && <line x1={pt(values[hi], hi)[0]} x2={pt(values[hi], hi)[0]} y1={0} y2={H} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {hi != null && (
        <div role="tooltip" className="absolute bottom-full mb-1 pointer-events-none whitespace-nowrap mono text-[11px] px-2 py-1 rounded-md border"
          style={{ left: `${hx}%`, transform: `translateX(${hx > 70 ? '-100%' : hx < 30 ? '0' : '-50%'})`, background: 'var(--surface)', borderColor: 'var(--line-strong)', color: 'var(--text)' }}>
          {labels?.[hi] ? `${labels[hi]} · ` : ''}{values[hi].toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function Kpi({ label, value, format, unit, delta, deltaGoodWhen = 'down', sub, spark, sparkLabels, tone = 'var(--ice)' }: {
  /** delta: percent change against the comparison period. */
  label: string; value: number; format?: (x: number) => string; unit?: string; delta?: number | null; deltaGoodWhen?: 'up' | 'down'; sub?: string; spark?: number[]; sparkLabels?: string[]; tone?: string;
}) {
  const good = delta == null || delta === 0 ? null : (delta > 0) === (deltaGoodWhen === 'up');
  return (
    <div className="panel hover-lift p-4 flex flex-col gap-1">
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="display text-[30px] font-semibold leading-none mono"><CountUp value={value} format={format} /></span>
        {unit && <span className="text-xs muted">{unit}</span>}
        {delta != null && delta !== 0 && (
          <span className="mono text-xs font-medium inline-flex items-center gap-0.5" style={{ color: good ? 'var(--mint)' : 'var(--coral)' }}>
            {delta > 0 ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />}{Math.round(Math.abs(delta))}%
          </span>
        )}
      </div>
      {sub && <div className="text-xs muted">{sub}</div>}
      {spark && <div className="mt-1"><Spark values={spark} labels={sparkLabels} color={tone} /></div>}
    </div>
  );
}

/** Names the Snowflake capability behind a component. */
export function PoweredBy({ children }: { children: ReactNode }) {
  return (
    <span className="pill" style={{ color: 'var(--ice)', background: 'color-mix(in srgb, var(--ice) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--ice) 26%, transparent)' }}>
      <Snowflake className="w-3 h-3 shrink-0" aria-hidden /><span className="truncate">Powered by {children}</span>
    </span>
  );
}

export function SampleAiBadge() {
  return (
    <span className="pill" title="Captured from a live run; in no-account mode it is replayed, not generated"
      style={{ color: 'var(--violet)', background: 'color-mix(in srgb, var(--violet) 13%, transparent)', borderColor: 'color-mix(in srgb, var(--violet) 32%, transparent)' }}>
      <Bot className="w-3 h-3" aria-hidden />Sample AI response
    </span>
  );
}

/** Where data came from; latency only when measured in live mode. */
export function SourceBadge({ p }: { p?: Provenance }) {
  if (!p) return null;
  if (p.source === 'mock') return <span className="pill" style={{ color: 'var(--muted)', background: 'var(--surface-2)', borderColor: 'var(--line)' }}><Database className="w-3 h-3" aria-hidden />Sample data</span>;
  return (
    <span className="pill mono" title="Measured round trip from the app server to Snowflake" style={{ color: 'var(--mint)', background: 'color-mix(in srgb, var(--mint) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--mint) 26%, transparent)' }}>
      <Timer className="w-3 h-3" aria-hidden />Live · {p.role}{p.latencyMs !== undefined ? ` · ${p.latencyMs.toLocaleString()} ms` : ''}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Page-level loading state: header, a KPI row and two panels as shimmer blocks. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-5" role="status" aria-label={label}>
      <Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-80 max-w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      {icon && <div className="mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{icon}</div>}
      <div className="font-semibold text-sm">{title}</div>
      {children && <div className="text-xs muted mt-1">{children}</div>}
    </div>
  );
}

// Sortable tables -------------------------------------------------------------------------------
export type SortDir = 'asc' | 'desc';
export function useSort<T>(rows: T[], initial: { key: keyof T & string; dir: SortDir }) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
    return sort.dir === 'asc' ? c : -c;
  }), [rows, sort]);
  const toggle = (key: keyof T & string) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  return { sorted, sort, toggle };
}
export function SortTh<T>({ k, label, s, className }: { k: keyof T & string; label: string; s: { sort: { key: string; dir: SortDir }; toggle: (k: keyof T & string) => void }; className?: string }) {
  const on = s.sort.key === k;
  return (
    <th className={className} aria-sort={on ? (s.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => s.toggle(k)}>{label}{on ? (s.sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" aria-hidden /> : <ArrowDown className="w-3 h-3" aria-hidden />) : <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden />}</button>
    </th>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg p-0.5 gap-0.5 flex-wrap" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className="px-2.5 h-7 rounded-md text-xs font-medium transition-colors"
          style={value === o.value ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' } : { color: 'var(--text-2)' }}>
          {o.label}{o.count !== undefined && <span className="mono ml-1 muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Right-hand detail drawer on phones and tablets; inline column on wide screens. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <div className="hidden xl:block min-w-0">{children}</div>
      {open && (
        <div className="xl:hidden fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-black/55" aria-label="Close details" onClick={onClose} tabIndex={-1} />
          <div className="drawer relative w-full sm:w-[36rem] max-w-full h-full overflow-y-auto p-3 sm:p-4" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--line)' }}>
            <div className="flex items-center justify-between mb-3"><span className="eyebrow">{title}</span>
              <button ref={ref} className="btn btn-sm" onClick={onClose}><X className="w-3.5 h-3.5" aria-hidden />Close</button></div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

// AI text --------------------------------------------------------------------------------------
/** Reveals text word by word, like a streamed response. Screen readers get the full text at once. */
export function StreamText({ text, onDone }: { text: string; onDone?: () => void }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { const t = window.setTimeout(() => { setK(words.length); onDone?.(); }); return () => window.clearTimeout(t); }
    let i = 0;
    const id = window.setInterval(() => { i += 3; setK(Math.min(words.length, i)); if (i >= words.length) { window.clearInterval(id); onDone?.(); } }, 28);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);
  const shown = words.slice(0, k).join('');
  return (
    <>
      <span className="sr-only">{text}</span>
      <div aria-hidden className={k < words.length ? 'caret' : ''}><Markdown text={shown} /></div>
    </>
  );
}

function inline(s: string, key: number): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return <span key={key}>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') && p.endsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p)}</span>;
}
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+/.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, '')); i++; }
      const li = items.map((t, j) => <li key={j}>{inline(t, j)}</li>);
      out.push(ordered ? <ol key={k++}>{li}</ol> : <ul key={k++}>{li}</ul>);
      continue;
    }
    if (/^#{1,4}\s/.test(l)) { out.push(<p key={k++}><strong>{l.replace(/^#+\s/, '')}</strong></p>); i++; continue; }
    if (l.trim()) out.push(<p key={k++}>{inline(l, 0)}</p>);
    i++;
  }
  return <div className="prose-ai text-[13.5px] leading-relaxed">{out}</div>;
}
