'use client';

// Anomaly monitor: daily events and regulator rejects per source system against the
// SNOWFLAKE.ML.ANOMALY_DETECTION forecast band, with flagged days.
import { Area, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { TIP, day } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { AnomalySeries } from '@/lib/types';

function SeriesChart({ s }: { s: AnomalySeries }) {
  const pts = s.points.map((p) => ({ ...p, label: day(p.date), band: [Math.max(0, p.lower), p.upper], flag: p.is_anomaly ? p.y : null }));
  const flagged = s.points.filter((p) => p.is_anomaly);
  return (
    <Card title={`${s.system} · ${s.metric}`} right={flagged.length ? <Tag tone="bad">{flagged.length} flagged</Tag> : <Tag tone="good">Normal</Tag>}>
      <div className="h-40" role="img" aria-label={`${s.system} ${s.metric} per trade date with forecast band. ${flagged.length ? `Anomalies on ${flagged.map((p) => day(p.date)).join(', ')}` : 'No anomalies'}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ left: -18, right: 6, top: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
            <Tooltip contentStyle={TIP} formatter={(v) => (Array.isArray(v) ? `${Math.round(Number(v[0]))} to ${Math.round(Number(v[1]))}` : Math.round(Number(v)).toLocaleString()) as never} labelFormatter={(l) => String(l)} />
            <Area dataKey="band" name="Expected range" fill="var(--accent-soft)" stroke="none" isAnimationActive={false} />
            <Line dataKey="y" name="Actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="flag" name="Anomaly" fill="var(--negative)" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {flagged.length > 0 && <p className="text-xs mt-1" style={{ color: 'var(--negative)' }}>{flagged.map((p) => `${day(p.date)}: ${Math.round(p.y)} (expected ${Math.max(0, Math.round(p.lower))} to ${Math.round(p.upper)})`).join(' · ')}</p>}
    </Card>
  );
}

export default function AnomaliesPage() {
  const { data: d, error, loading } = useAsync(() => data.anomalies(), []);
  if (error) return <ErrorBox error={error} />;
  if (loading || !d) return <Thinking label="Loading anomaly results" />;
  const order = (m: string) => d.series.filter((s) => s.metric === m);
  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Anomaly monitor</h1>
          <p className="text-sm text-2 mt-1">October trade dates scored against a model trained on June to September (99% prediction interval)</p>
        </div>
        <div className="flex gap-2 flex-wrap"><PoweredBy>SNOWFLAKE.ML.ANOMALY_DETECTION</PoweredBy><SourceBadge p={d} /></div>
      </div>
      <h2 className="text-sm font-semibold">Regulator rejects per day</h2>
      <div className="grid md:grid-cols-2 gap-4">{order('rejects').map((s) => <SeriesChart key={s.series} s={s} />)}</div>
      <h2 className="text-sm font-semibold">Events reported per day</h2>
      <div className="grid md:grid-cols-2 gap-4">{order('events').map((s) => <SeriesChart key={s.series} s={s} />)}</div>
    </div>
  );
}
