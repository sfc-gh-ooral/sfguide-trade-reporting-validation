// Status pills and the error panel used across screens.
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  good: 'var(--mint)', bad: 'var(--coral)', warn: 'var(--signal)', info: 'var(--ice)', ai: 'var(--violet)', muted: 'var(--muted)',
} as const;
export type Tone = keyof typeof TONES;

export function Tag({ tone = 'muted', children, title, mono }: { tone?: Tone; children: ReactNode; title?: string; mono?: boolean }) {
  const c = TONES[tone];
  return (
    <span title={title} className={`pill ${mono ? 'mono' : ''}`}
      style={{ color: c, background: `color-mix(in srgb, ${c} 13%, transparent)`, borderColor: `color-mix(in srgb, ${c} 28%, transparent)` }}>
      {children}
    </span>
  );
}

export function StatusTag({ status, assignee }: { status: string; assignee?: string | null }) {
  if (status === 'Repaired') return <Tag tone="good">Repaired</Tag>;
  if (status === 'Assigned') return <Tag tone="info" title={assignee ?? undefined}>Assigned{assignee ? ` · ${assignee.split(' ')[0]}` : ''}</Tag>;
  return <Tag tone="warn">Open</Tag>;
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div role="alert" className="panel p-4 text-sm flex gap-3 items-start" style={{ borderColor: 'var(--coral)' }}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--coral)' }} aria-hidden />
      <div><div className="font-semibold">Couldn&apos;t load from Snowflake</div><div className="text-2 mono text-xs mt-1 break-all">{error}</div>
        <div className="muted text-xs mt-1">Live mode never falls back to sample data. Check the connection in .env.local, or switch to Sample.</div></div>
    </div>
  );
}
