// Small status pills used across screens.
import type { ReactNode } from 'react';

const TONES = {
  good: ['var(--positive)', 'color-mix(in srgb, var(--positive) 13%, transparent)'],
  bad: ['var(--negative)', 'color-mix(in srgb, var(--negative) 12%, transparent)'],
  warn: ['var(--warning)', 'color-mix(in srgb, var(--warning) 14%, transparent)'],
  info: ['var(--accent)', 'var(--accent-soft)'],
  muted: ['var(--muted)', 'var(--surface-2)'],
} as const;

export function Tag({ tone = 'muted', children, title }: { tone?: keyof typeof TONES; children: ReactNode; title?: string }) {
  const [color, bg] = TONES[tone];
  return <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color, background: bg }}>{children}</span>;
}

export function ErrorBox({ error }: { error: string }) {
  return <div role="alert" className="card p-4 text-sm" style={{ borderColor: 'var(--negative)', color: 'var(--negative)' }}>Couldn&apos;t load from Snowflake: {error}</div>;
}
