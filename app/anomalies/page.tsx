'use client';

// Anomaly monitor: daily events and regulator rejects per source system against the
// SNOWFLAKE.ML.ANOMALY_DETECTION forecast band, with flagged days.
import { useState } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, TIP, day } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { PageHeader, PageSkeleton, Panel, PoweredBy, Segmented, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { AnomalySeries } from '@/lib/types';

function SeriesChart({ s }: { s: AnomalySeries }) {
  const pts = s.points.map((p) => ({ ...p, label: day(p.date), band: [Math.max(0, p.lower), p.upper], flag: p.is_anomaly ? p.y : null }));
  const flagged = s.points.filter((p) => p.is_anomaly);
  const color = s.metric === 'rejects' ? 'var(--coral)' : 'var(--ice)';
  return (
    <Panel eyebrow={s.metric === 'rejects' ? 'Rejects per day' : 'Events per day'} title={s.system} className="hover-lift"
      right={flagged.length ? <Tag tone="bad">{flagged.length} flagged</Tag> : <Tag tone="good">Normal</Tag>}>
      <div className="h-44" role="img" aria-label={`${s.system} ${s.metric} per trade date with the expected range. ${flagged.length ? `Anomalies on ${flagged.map((p) => day(p.date)).join(', ')}` : 'No anomalies'}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ left: -20, right: 6, top: 4 }}>
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TIP} formatter={(v, name) => [Array.isArray(v) ? `${Math.round(Number(v[0]))} to ${Math.round(Number(v[1]))}` : Math.round(Number(v)).toLocaleString(), name] as never} />
            <Area dataKey="band" name="Expected range" fill="var(--band)" stroke="none" animationDuration={500} />
            <Line dataKey="y" name="Actual" stroke={color} strokeWidth={2} dot={false} animationDuration={600} />
            <Scatter dataKey="flag" name="Anomaly" fill="var(--signal)" shape={(p: { cx?: number; cy?: number }) => p.cx == null || p.cy == null ? <g /> : <g><circle cx={p.cx} cy={p.cy} r={9} fill="var(--signal)" opacity={0.2} /><circle cx={p.cx} cy={p.cy} r={4} fill="var(--signal)" /></g>} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11.5px] mt-2 mono min-h-[1.2em]" style={{ color: flagged.length ? 'var(--signal)' : 'var(--muted)' }}>
        {flagged.length ? flagged.map((p) => `${day(p.date)}: ${Math.round(p.y)} (expected ${Math.max(0, Math.round(p.lower))}–${Math.round(p.upper)})`).join(' · ') : 'Every day inside the expected range'}</p>
    </Panel>
  );
}

export default function AnomaliesPage() {
  const { data: d, error } = useAsync(() => data.anomalies(), []);
  const [metric, setMetric] = useState<'rejects' | 'events'>('rejects');
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading anomaly results" />;
  const shown = d.series.filter((s) => s.metric === metric);
  const flags = d.series.flatMap((s) => s.points.filter((p) => p.is_anomaly).map((p) => ({ ...p, s })));
  const byDay = [...new Set(flags.map((f) => f.date))].sort();

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="Anomaly monitor" title="Volumes and error rates by source system"
        sub="October trade dates scored against a model trained on June to September, with a 99% prediction interval."
        right={<><PoweredBy>SNOWFLAKE.ML.ANOMALY_DETECTION</PoweredBy><SourceBadge p={d} /></>} />
      <Panel eyebrow="Flagged days" title={`${flags.length} anomalies on ${byDay.length} trade dates`}>
        <div className="flex gap-2 flex-wrap">
          {byDay.map((dt) => (
            <div key={dt} className="rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <div className="mono text-[13px] font-semibold" style={{ color: 'var(--signal)' }}>{day(dt)}</div>
              <div className="text-[11.5px] muted">{flags.filter((f) => f.date === dt).map((f) => `${f.s.system} ${f.s.metric}`).join(', ')}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Segmented label="Metric" value={metric} onChange={setMetric} options={[{ value: 'rejects', label: 'Regulator rejects' }, { value: 'events', label: 'Events reported' }]} />
      <div className="grid md:grid-cols-2 gap-4">{shown.map((s) => <SeriesChart key={s.series} s={s} />)}</div>
    </div>
  );
}
