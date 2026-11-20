'use client';

// Pre-submission checks: rule results for one trade date, drill-down to failing records,
// and the books-to-CAT reconciliation.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { clock, dayLong, n } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const DRILLABLE = new Set(['R-LNK-01', 'R-SEQ-02', 'R-FLD-03', 'R-CMP-05']);
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d/.test(v) ? clock(v.replace(' ', 'T')) : String(v));

function Records({ ruleId, tradeDate }: { ruleId: string; tradeDate: string }) {
  const { data: r, error, loading } = useAsync(() => data.checkRecords(ruleId, tradeDate), [ruleId, tradeDate]);
  if (error) return <ErrorBox error={error} />;
  if (loading || !r) return <Thinking label="Loading records" />;
  if (!r.rows.length) return <p className="text-sm muted">No failing records for this rule on this date.</p>;
  const keys = Object.keys(r.rows[0].detail);
  return (
    <div className="overflow-x-auto relative">
      <p className="text-xs muted mb-2">{r.total > r.rows.length ? `First ${r.rows.length} of ${r.total}` : `${r.total}`} failing records. Open an order to see its lifecycle.</p>
      <table className="data-table">
        <thead><tr><th>Record</th><th>Order</th><th>System · desk</th>{keys.map((k) => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.record_id}>
              <td className="text-xs tabular">{x.record_id}</td>
              <td><Link className="underline text-xs" href={`/order?id=${x.order_id}`}>{x.order_id}</Link></td>
              <td className="text-xs">{x.source_system} · {x.desk}</td>
              {keys.map((k) => <td key={k} className="text-xs tabular">{show(x.detail[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Checks() {
  const params = useSearchParams();
  const router = useRouter();
  const date = params.get('date') ?? undefined;
  const [rule, setRule] = useState<string>();
  const { data: d, error, loading } = useAsync(() => data.checks(date), [date]);
  if (error) return <ErrorBox error={error} />;
  if (loading || !d) return <Thinking label="Loading checks" />;
  const selected = rule ?? d.rules.find((r) => r.failures > 0 && DRILLABLE.has(r.rule_id))?.rule_id;
  const missing = d.recon.reduce((a, r) => a + r.missing_from_cat, 0);

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Pre-submission checks</h1>
          <p className="text-sm text-2 mt-1">Rule library run against the reporting feed for {dayLong(d.tradeDate)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs muted" htmlFor="td">Trade date</label>
          <select id="td" className="input" value={d.tradeDate} onChange={(e) => { setRule(undefined); router.push(`/checks?date=${e.target.value}`); }}>
            {[...d.tradeDates].reverse().map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <SourceBadge p={d} />
        </div>
      </div>

      <Card title="Rule results" right={<><PoweredBy>Dynamic Tables</PoweredBy><PoweredBy>Data metric functions</PoweredBy></>}>
        <div className="overflow-x-auto relative">
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Method</th><th>Version</th><th>Severity</th><th>Checked</th><th>Failures</th><th></th></tr></thead>
            <tbody>
              {d.rules.map((r) => (
                <tr key={r.rule_id} className={r.rule_id === selected ? 'row-selected' : undefined}>
                  <td><div className="font-medium">{r.rule_id} {r.name}</div><div className="text-xs muted max-w-[26rem]">{r.description}</div></td>
                  <td className="text-xs">{r.method}</td>
                  <td className="text-xs tabular">v{r.version}</td>
                  <td>{r.severity === 'High' ? <Tag tone="bad">High</Tag> : <Tag tone="warn">Medium</Tag>}</td>
                  <td className="tabular">{n(r.records_checked)}</td>
                  <td className="tabular">{r.failures ? <Tag tone="bad">{r.failures}</Tag> : <Tag tone="good">0</Tag>}</td>
                  <td>{r.failures > 0 && DRILLABLE.has(r.rule_id) && <button className="btn !py-1 text-xs" onClick={() => setRule(r.rule_id)}>Records</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <Card title={`Failing records: ${selected}`}><Records ruleId={selected} tradeDate={d.tradeDate} /></Card>}

      <Card title="Books-to-CAT reconciliation" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
        <p className="text-xs text-2 mb-2">Executions in the books against EXECUTE events in the reporting feed, by source system.
          {missing > 0 ? <strong style={{ color: 'var(--negative)' }}> {missing} executions are missing from CAT.</strong> : ' Every execution is reported.'}</p>
        <div className="overflow-x-auto relative">
          <table className="data-table">
            <thead><tr><th>Source system</th><th>Books executions</th><th>Reported</th><th>Missing</th><th>Complete</th></tr></thead>
            <tbody>
              {d.recon.map((r) => (
                <tr key={r.source_system}>
                  <td className="font-medium">{r.source_system}</td>
                  <td className="tabular">{n(r.books_executions)}</td>
                  <td className="tabular">{n(r.reported_executions)}</td>
                  <td className="tabular">{r.missing_from_cat ? <Tag tone="bad">{r.missing_from_cat}</Tag> : 0}</td>
                  <td className="tabular text-xs">{((100 * r.reported_executions) / Math.max(1, r.books_executions)).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function ChecksPage() {
  return <Suspense fallback={<Thinking label="Loading checks" />}><Checks /></Suspense>;
}
