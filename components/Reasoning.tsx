'use client';

// Staged progress for AI calls. The steps name what the live path does; callers pass counts so the
// text reads like the real work ("Reading 23 rejects in this cluster"). Steps advance on a timer and
// the last one holds until the real (or sample) answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = keyof typeof SAMPLE_DELAY_MS;

export function Reasoning({ kind, steps, title = 'Working' }: { kind: ReasoningKind; steps: string[]; title?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, []);
  const per = SAMPLE_DELAY_MS[kind] / steps.length;
  const step = Math.min(steps.length - 1, Math.floor(elapsed / per));

  return (
    <div className="ai-panel fade-up" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="eyebrow !text-[10.5px]" style={{ color: 'var(--violet)' }}>{title}</span>
        <span className="mono text-[11px] muted">{(elapsed / 1000).toFixed(1)} s</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className="flex items-center gap-2.5 text-[13px] transition-opacity" style={{ opacity: state === 'todo' ? 0.45 : 1 }}>
              {state === 'done' ? <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--mint)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--violet)' }} aria-hidden />
                : <span className="w-4 h-4 shrink-0 rounded-full border" style={{ borderColor: 'var(--line-strong)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden>
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%`, background: 'var(--violet)' }} />
      </div>
    </div>
  );
}
