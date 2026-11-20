'use client';

// Submission health: the latest trade date against the October trend, the repair backlog, where the
// rejects come from, and where to start. Story beat 1: the reject spike on the latest file.
import { ArrowRight, Flame } from 'lucide-react';
import Link from 'next/link';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, CODE_COLORS, CODE_NAMES, TIP, day, dayLong, n } from '@/components/fmt';
import { ErrorBox, StatusTag, Tag } from '@/components/Status';
import { Kpi, PageHeader, PageSkeleton, Panel, PoweredBy, SourceBadge, SortTh, useSort } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const pct = (now: number, base: number) => (base ? ((now - base) / base) * 100 : null);

export default function HealthPage() {
  const { data: d, error } = useAsync(() => Promise.all([data.health(), data.rejects()]), []);
  const rows = (d?.[0].trend ?? []).slice(-8).reverse().map((t) => {
    const top = Object.entries(t.by_code).sort((a, b) => b[1] - a[1])[0];
    return { ...t, top: top ? `${top[0]} ${CODE_NAMES[top[0]]} (${top[1]})` : '—' };
  });
  const sort = useSort(rows, { key: 'trade_date', dir: 'desc' });
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading submission health" />;
  const [h, rj] = d;
  const k = h.kpis;
  const prior = h.trend.slice(-6, -1);
  const avg = (f: (x: (typeof prior)[number]) => number) => prior.reduce((a, x) => a + f(x), 0) / Math.max(1, prior.length);
  const codes = Object.keys(CODE_COLORS);
  const trend = h.trend.map((t) => ({ ...t, label: day(t.trade_date), ...Object.fromEntries(codes.map((c) => [c, t.by_code[c] ?? 0])) }));
  const latest = h.trend.at(-1)!;
  const lead = rj.clusters.find((c) => c.trade_dates.includes(h.latestTradeDate) && c.open + c.assigned > 0);
  const leadToday = lead ? lead.items.filter((i) => i.trade_date === h.latestTradeDate).length : 0;
  const openClusters = rj.clusters.filter((c) => c.open + c.assigned > 0);

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="Submission health · CAT and CAIS" title="Is today's file safe to send?"
        sub={<>Trade date {dayLong(h.latestTradeDate)} against the October trend. Every figure is computed from the synthetic Northwind Securities feed.</>}
        right={<><PoweredBy>Dynamic Tables</PoweredBy><SourceBadge p={h} /></>} />

      {lead && (
        <Link href="/rejects" className="panel hover-lift p-4 sm:p-5 flex items-start gap-4 no-underline flex-wrap sm:flex-nowrap"
          style={{ borderColor: 'color-mix(in srgb, var(--coral) 45%, var(--line))', background: 'linear-gradient(100deg, color-mix(in srgb, var(--coral) 10%, var(--surface)) 0%, var(--surface) 60%)' }}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--coral) 18%, transparent)', color: 'var(--coral)' }}><Flame className="w-5 h-5" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow" style={{ color: 'var(--coral)' }}>Reject spike on the {day(h.latestTradeDate)} file</span>
            <span className="block display text-[19px] font-semibold mt-0.5">{latest.rejects} rejects against a {avg((x) => x.rejects).toFixed(1)} per-day average. {leadToday} are {lead.error_code} {CODE_NAMES[lead.error_code].toLowerCase()}s from one system: <span className="mono">{lead.source_system}</span> on the {lead.desk.toLowerCase().replace('-', ' ')} desk.</span>
            <span className="block text-xs text-2 mt-1">Pre-submission checks flagged {k.caught} of {k.caughtOf} of these rejects before the file went out, on this synthetic data set.</span>
          </span>
          <span className="btn btn-primary self-center">Work the cluster<ArrowRight className="w-4 h-4" aria-hidden /></span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Events reported" value={k.records} delta={pct(k.records, avg((x) => x.events))} deltaGoodWhen="up" sub={`vs prior 5 trading days`} spark={h.trend.map((t) => t.events)} />
        <Kpi label="Check failures" value={k.checkFailures} delta={pct(k.checkFailures, avg((x) => x.check_failures))} sub="Pre-submission rules" spark={h.trend.map((t) => t.check_failures)} tone="var(--signal)" />
        <Kpi label="Regulator rejects" value={k.rejects} delta={pct(k.rejects, avg((x) => x.rejects))} sub="Feedback on the latest file" spark={h.trend.map((t) => t.rejects)} tone="var(--coral)" />
        <Kpi label="Caught before submission" value={k.caughtOf ? (100 * k.caught) / k.caughtOf : 0} format={(x) => `${Math.round(x)}%`} sub={`${k.caught} of ${k.caughtOf} rejects matched a check`} tone="var(--mint)" />
        <Kpi label="Repair backlog" value={k.backlog} sub={`${openClusters.length} open root-cause clusters + CAIS`} tone="var(--signal)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" eyebrow="Regulator feedback" title="Rejects by error code and trade date" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
          <div className="h-72" role="img" aria-label={`Stacked bar chart of rejects per trade date by error code. Latest day ${k.rejects} rejects against an average of ${avg((x) => x.rejects).toFixed(1)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ left: -20, right: 6, top: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TIP} cursor={{ fill: 'color-mix(in srgb, var(--surface-2) 70%, transparent)' }} formatter={(v, name) => [v, `${name} ${CODE_NAMES[String(name)] ?? ''}`]} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="circle" iconSize={8} formatter={(v) => `${v} ${CODE_NAMES[v] ?? ''}`} />
                {codes.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CODE_COLORS[c]} radius={i === codes.length - 1 ? [3, 3, 0, 0] : 0} animationDuration={600} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel eyebrow="Volume" title="Events and check failures">
          <div className="h-72" role="img" aria-label="Events reported per trade date as an area, with pre-submission check failures as a line.">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ left: -14, right: -8, top: 6 }}>
                <defs><linearGradient id="ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--ice)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--ice)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="l" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="circle" iconSize={8} />
                <Area yAxisId="l" dataKey="events" name="Events" stroke="var(--ice)" fill="url(#ev)" strokeWidth={1.6} animationDuration={600} />
                <Line yAxisId="r" dataKey="check_failures" name="Check failures" stroke="var(--signal)" strokeWidth={2} dot={false} animationDuration={600} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3" eyebrow="Daily files" title="Last eight trade dates" pad={false}>
          <div className="scroller">
            <table className="tbl">
              <thead><tr>
                <SortTh k="trade_date" label="Trade date" s={sort} /><SortTh k="events" label="Events" s={sort} /><SortTh k="check_failures" label="Check fails" s={sort} />
                <SortTh k="rejects" label="Rejects" s={sort} /><th>Top error</th></tr></thead>
              <tbody>
                {sort.sorted.map((t) => (
                  <tr key={t.trade_date}>
                    <td><Link className="underline decoration-dotted underline-offset-2" href={`/checks?date=${t.trade_date}`}>{dayLong(t.trade_date)}</Link></td>
                    <td className="mono">{n(t.events)}</td>
                    <td className="mono">{t.check_failures}</td>
                    <td>{t.rejects > avg((x) => x.rejects) * 2 ? <Tag tone="bad" mono>{t.rejects}</Tag> : <span className="mono">{t.rejects}</span>}</td>
                    <td className="text-xs text-2">{t.top}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-2" eyebrow="Repair queue" title="Where to start" right={<Link href="/rejects" className="text-xs underline">All clusters</Link>}>
          <ul className="space-y-2">
            {openClusters.slice(0, 4).map((c) => (
              <li key={c.cluster_id}>
                <Link href="/rejects" className="flex items-center gap-3 p-3 rounded-lg no-underline hover-lift" style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: CODE_COLORS[c.error_code] }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap"><span className="mono text-[13px] font-semibold">{c.error_code}</span><span className="text-sm">{CODE_NAMES[c.error_code]}</span></span>
                    <span className="block text-xs muted mono truncate">{c.source_system} · {c.desk} · {c.trade_dates.map(day).join(', ')}</span>
                  </span>
                  <StatusTag status="Open" /><span className="mono text-sm font-semibold">{c.open + c.assigned}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] muted mt-3">Clusters group regulator feedback by error code, source system and desk. Repairs are due on the third trading day after the trade date (an illustrative rule).</p>
        </Panel>
      </div>
    </div>
  );
}
