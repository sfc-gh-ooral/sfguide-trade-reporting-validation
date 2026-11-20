'use client';

// Submission health: the latest trade date against the October trend, the repair backlog,
// and the countdown to the oldest open repair deadline.
import { AlarmClock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CODE_COLORS, CODE_NAMES, TIP, countdown, day, dayLong, n, stamp } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, Kpi, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

export default function HealthPage() {
  const { data: d, error, loading } = useAsync(() => data.health(), []);
  if (error) return <ErrorBox error={error} />;
  if (loading || !d) return <Thinking label="Loading submission health" />;
  const k = d.kpis;
  const prior = d.trend.slice(0, -1);
  const avgRejects = prior.reduce((a, x) => a + x.rejects, 0) / Math.max(1, prior.length);
  const codes = Object.keys(CODE_COLORS);
  const trend = d.trend.map((t) => ({ ...t, label: day(t.trade_date), ...Object.fromEntries(codes.map((c) => [c, t.by_code[c] ?? 0])) }));

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Submission health</h1>
          <p className="text-sm text-2 mt-1">CAT trade date {dayLong(d.latestTradeDate)} · business clock {stamp(d.asOf)}</p>
        </div>
        <SourceBadge p={d} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Events reported" value={n(k.records)} sub={`Trade date ${day(d.latestTradeDate)}`} />
        <Kpi label="Check failures" value={n(k.checkFailures)} sub="Pre-submission rules" />
        <Kpi label="Regulator rejects" value={n(k.rejects)} sub={`October average ${avgRejects.toFixed(1)} per day`} />
        <Kpi label="Caught before submission" value={k.caughtOf ? `${Math.round((100 * k.caught) / k.caughtOf)}%` : '—'} sub={`${k.caught} of ${k.caughtOf} rejects matched a check`} />
        <Kpi label="Repair backlog" value={n(k.backlog)} sub="Open or assigned, CAT and CAIS" />
      </div>

      {d.deadline && (
        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="icon-tile w-10 h-10 rounded-xl flex items-center justify-center"><AlarmClock className="w-5 h-5" aria-hidden /></div>
            <div className="flex-1 min-w-[14rem]">
              <div className="text-sm font-semibold">Repair deadline for trade date {dayLong(d.deadline.tradeDate)}</div>
              <div className="text-xs muted">{d.deadline.open} open rejects due {stamp(d.deadline.due)} (illustrative rule: third trading day after the trade date, 08:00 ET)</div>
            </div>
            <div className="text-2xl font-bold tabular" style={{ color: 'var(--warning)' }}>{countdown(d.asOf, d.deadline.due)}</div>
            <Link href="/rejects" className="btn">Open the workbench<ArrowRight className="w-4 h-4" aria-hidden /></Link>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Regulator rejects by error code" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
          <div className="h-64" role="img" aria-label={`Stacked bar chart of rejects per trade date. Latest day ${k.rejects} rejects against an average of ${avgRejects.toFixed(1)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ left: -18, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={TIP} cursor={{ fill: 'var(--surface-2)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => `${v} ${CODE_NAMES[v] ?? ''}`} />
                {codes.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={CODE_COLORS[c]} isAnimationActive={false} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Volume and check failures">
          <div className="h-64" role="img" aria-label="Line chart of events reported and pre-submission check failures per trade date.">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ left: -14, right: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval="preserveStartEnd" />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="events" name="Events" fill="var(--chart-1)" opacity={0.45} isAnimationActive={false} />
                <Line yAxisId="r" dataKey="check_failures" name="Check failures" stroke="var(--chart-5)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Last five trade dates">
        <div className="overflow-x-auto relative">
          <table className="data-table">
            <thead><tr><th>Trade date</th><th>Events</th><th>Check failures</th><th>Rejects</th><th>Top error</th></tr></thead>
            <tbody>
              {d.trend.slice(-5).reverse().map((t) => {
                const top = Object.entries(t.by_code).sort((a, b) => b[1] - a[1])[0];
                return (
                  <tr key={t.trade_date}>
                    <td><Link className="underline" href={`/checks?date=${t.trade_date}`}>{dayLong(t.trade_date)}</Link></td>
                    <td className="tabular">{n(t.events)}</td>
                    <td className="tabular">{t.check_failures}</td>
                    <td className="tabular">{t.rejects > avgRejects * 2 ? <Tag tone="bad">{t.rejects}</Tag> : t.rejects}</td>
                    <td className="text-xs">{top ? `${top[0]} ${CODE_NAMES[top[0]]} (${top[1]})` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
