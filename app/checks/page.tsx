'use client';

// Pre-submission checks: the rule library run for one trade date, drill-down to failing records, and
// the books-to-CAT reconciliation (completeness). Story beat: the linkage break and the missing fills.
import { CheckCircle2, ChevronRight, CircleAlert, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, TIP, clock, dayLong, n } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Empty, PageHeader, PageSkeleton, Panel, PoweredBy, Segmented, Skeleton, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { RuleResult } from '@/lib/types';

const DRILLABLE = new Set(['R-LNK-01', 'R-SEQ-02', 'R-FLD-03', 'R-CMP-05']);
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d/.test(v) ? clock(v.replace(' ', 'T')) : String(v));

function Records({ ruleId, tradeDate }: { ruleId: string; tradeDate: string }) {
  const { data: r, error } = useAsync(() => data.checkRecords(ruleId, tradeDate), [ruleId, tradeDate]);
  const [q, setQ] = useState('');
  const rows = useMemo(() => (r?.rows ?? []).filter((x) => !q || `${x.record_id} ${x.order_id} ${x.desk} ${x.source_system}`.toLowerCase().includes(q.toLowerCase())), [r, q]);
  if (error) return <ErrorBox error={error} />;
  if (!r) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (!r.rows.length) return <Empty icon={<CheckCircle2 className="w-5 h-5" />} title="No failing records">This rule passed for every record on this trade date.</Empty>;
  const keys = Object.keys(r.rows[0].detail);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="text-xs muted">{r.total > r.rows.length ? `First ${r.rows.length} of ${n(r.total)}` : n(r.total)} failing records. Open an order to see its lifecycle.</p>
        <label className="relative"><span className="sr-only">Filter records</span>
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 muted" aria-hidden />
          <input className="input !pl-8 w-56 max-w-full" placeholder="Filter by ID, desk, system" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="scroller max-h-[26rem] rounded-lg" style={{ border: '1px solid var(--line)' }}>
        <table className="tbl">
          <thead><tr><th>Record</th><th>Order</th><th>System · desk</th>{keys.map((k) => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.record_id}>
                <td className="mono text-xs">{x.record_id}</td>
                <td><Link className="mono text-xs underline decoration-dotted underline-offset-2" href={`/order?id=${x.order_id}`}>{x.order_id}</Link></td>
                <td className="text-xs text-2 whitespace-nowrap">{x.source_system} · {x.desk}</td>
                {keys.map((k) => <td key={k} className="mono text-xs whitespace-nowrap">{show(x.detail[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="No records match the filter" />}
      </div>
    </div>
  );
}

function RuleTile({ r, selected, onPick }: { r: RuleResult; selected: boolean; onPick: () => void }) {
  const fail = r.failures > 0;
  const rate = r.records_checked ? (100 * r.failures) / r.records_checked : 0;
  const can = fail && DRILLABLE.has(r.rule_id);
  return (
    <button type="button" onClick={can ? onPick : undefined} aria-pressed={selected} disabled={!can}
      className="panel hover-lift text-left p-4 flex flex-col gap-2 disabled:cursor-default"
      style={selected ? { borderColor: 'var(--signal)', boxShadow: '0 0 0 1px var(--signal)' } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-xs muted">{r.rule_id} · v{r.version}</span>
        {fail ? <Tag tone="bad"><CircleAlert className="w-3 h-3" aria-hidden />{n(r.failures)} fail</Tag> : <Tag tone="good"><CheckCircle2 className="w-3 h-3" aria-hidden />Pass</Tag>}
      </div>
      <div className="font-semibold text-[14px] leading-snug">{r.name}</div>
      <div className="text-xs text-2 line-clamp-2">{r.description}</div>
      <div className="mt-auto pt-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden title={fail ? `${n(r.failures)} of ${n(r.records_checked)} records failed (${rate.toFixed(2)}%)` : `All ${n(r.records_checked)} records passed`}>
          <div className="h-full rounded-full" style={{ width: `${fail ? Math.max(3, Math.min(100, rate * 8)) : 100}%`, background: fail ? 'var(--coral)' : 'var(--mint)', opacity: fail ? 1 : 0.5 }} />
        </div>
        <div className="flex items-center justify-between text-[11px] muted mt-1.5 gap-2">
          <span className="mono">{n(r.records_checked)} checked · {rate.toFixed(2)}%</span>
          <span className="truncate">{r.method}</span>
          {can && <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />}
        </div>
      </div>
    </button>
  );
}

function Checks() {
  const params = useSearchParams();
  const router = useRouter();
  const date = params.get('date') ?? undefined;
  const [rule, setRule] = useState<string>();
  const [sev, setSev] = useState<'all' | 'High' | 'Medium' | 'failing'>('all');
  const { data: d, error } = useAsync(() => data.checks(date), [date]);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading checks" />;
  const selected = rule ?? d.rules.find((r) => r.failures > 0 && DRILLABLE.has(r.rule_id))?.rule_id;
  const missing = d.recon.reduce((a, r) => a + r.missing_from_cat, 0);
  const shown = d.rules.filter((r) => sev === 'all' || (sev === 'failing' ? r.failures > 0 : r.severity === sev));
  const sel = d.rules.find((r) => r.rule_id === selected);

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="Pre-submission checks" title={`Rule library · ${dayLong(d.tradeDate)}`}
        sub="Every rule runs against the reporting feed before the file goes out. Failures stream from a Dynamic Table; feed quality is measured with data metric functions."
        right={<>
          <label className="text-xs muted" htmlFor="td">Trade date</label>
          <select id="td" className="input mono" value={d.tradeDate} onChange={(e) => { setRule(undefined); router.push(`/checks?date=${e.target.value}`); }}>
            {[...d.tradeDates].reverse().map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <SourceBadge p={d} />
        </>} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented label="Filter rules" value={sev} onChange={setSev} options={[
          { value: 'all', label: 'All', count: d.rules.length }, { value: 'failing', label: 'Failing', count: d.rules.filter((r) => r.failures > 0).length },
          { value: 'High', label: 'High' }, { value: 'Medium', label: 'Medium' }]} />
        <div className="flex gap-2 flex-wrap"><PoweredBy>Dynamic Tables</PoweredBy><PoweredBy>Data metric functions</PoweredBy><PoweredBy>Window functions</PoweredBy></div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {shown.map((r) => <RuleTile key={r.rule_id} r={r} selected={r.rule_id === selected} onPick={() => setRule(r.rule_id)} />)}
      </div>

      {sel && <Panel eyebrow={`Failing records · ${sel.rule_id}`} title={sel.name}><Records ruleId={sel.rule_id} tradeDate={d.tradeDate} /></Panel>}

      <Panel eyebrow="Completeness" title="Books-to-CAT reconciliation" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
        <p className="text-sm text-2 mb-3">Executions in the books against EXECUTE events in the reporting feed, per source system.{' '}
          {missing > 0 ? <strong style={{ color: 'var(--coral)' }}>{missing} executions never reached the feed. The regulator can&apos;t reject what it never received, so only this check finds them.</strong> : 'Every execution in the books was reported.'}</p>
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="h-56" role="img" aria-label={`Bar chart of books executions and reported executions per source system. ${missing} missing.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.recon} margin={{ left: -16, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="source_system" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TIP} cursor={{ fill: 'color-mix(in srgb, var(--surface-2) 70%, transparent)' }} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="circle" iconSize={8} />
                <Bar dataKey="books_executions" name="In the books" fill="var(--line-strong)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="reported_executions" name="Reported to CAT" fill="var(--ice)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="scroller rounded-lg" style={{ border: '1px solid var(--line)' }}>
            <table className="tbl">
              <thead><tr><th>System</th><th>Books</th><th>Reported</th><th>Missing</th><th>Complete</th></tr></thead>
              <tbody>
                {d.recon.map((r) => (
                  <tr key={r.source_system}>
                    <td className="mono font-medium">{r.source_system}</td>
                    <td className="mono">{n(r.books_executions)}</td>
                    <td className="mono">{n(r.reported_executions)}</td>
                    <td>{r.missing_from_cat ? <button className="underline" onClick={() => setRule('R-CMP-05')}><Tag tone="bad" mono>{r.missing_from_cat}</Tag></button> : <span className="mono muted">0</span>}</td>
                    <td className="mono text-xs">{((100 * r.reported_executions) / Math.max(1, r.books_executions)).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function ChecksPage() {
  return <Suspense fallback={<PageSkeleton label="Loading checks" />}><Checks /></Suspense>;
}
