'use client';

// One order's lifecycle as an event timeline: firm events, the ATS's destination event, the
// executions in the books, and every check failure and regulator reject that touches the order.
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CODE_NAMES, clock, dayLong } from '@/components/fmt';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { OrderTimeline } from '@/lib/types';

const ms = (t: string) => Date.parse(`${t.slice(0, 23)}Z`);

/** Swimlanes: firm, destination ATS, books. Position is time; the dashed line is the NEW event. */
function Timeline({ d }: { d: OrderTimeline }) {
  const bad = new Set(d.failures.map((f) => f.record_id).concat(d.feedback.map((f) => f.event_id)));
  const pts = [
    ...d.events.map((e) => ({ lane: 0, id: e.event_id, label: e.event_type, t: ms(e.event_ts), ts: e.event_ts, bad: bad.has(e.event_id) })),
    ...d.destEvents.map((e) => ({ lane: 1, id: e.event_id, label: 'DEST_NEW', t: ms(e.event_ts), ts: e.event_ts, bad: false })),
    ...d.executions.map((x) => ({ lane: 2, id: x.execution_id, label: 'FILL', t: ms(x.exec_ts), ts: x.exec_ts, bad: bad.has(x.execution_id) })),
  ];
  const newT = d.events.find((e) => e.event_type === 'NEW');
  const W = 760, L = 120, R = 56, H = 52;
  // Order-preserving scale: events are spaced by rank so millisecond gaps stay readable, with the real time in the label.
  const sorted = [...pts].sort((a, b) => a.t - b.t);
  const x = (p: (typeof pts)[number]) => L + (sorted.indexOf(p) / Math.max(1, sorted.length - 1)) * (W - L - R);
  const lanes = ['Firm (CAT feed)', 'Destination ATS', 'Books'];
  return (
    <div className="overflow-x-auto relative">
      <svg viewBox={`0 0 ${W} ${H * 3 + 30}`} className="w-full min-w-[620px]" role="img"
        aria-label={`Timeline of ${pts.length} events in time order. ${pts.filter((p) => p.bad).map((p) => `${p.label} ${p.id} is flagged`).join('. ')}`}>
        {lanes.map((l, i) => (
          <g key={l}>
            <line x1={L - 6} x2={W - R + 10} y1={20 + i * H + 12} y2={20 + i * H + 12} stroke="var(--border)" />
            <text x={0} y={20 + i * H + 16} fontSize="11" fill="var(--muted)">{l}</text>
          </g>
        ))}
        {newT && (() => { const p = pts.find((q) => q.id === newT.event_id)!; return <line x1={x(p)} x2={x(p)} y1={8} y2={H * 3 + 14} stroke="var(--accent)" strokeDasharray="3 3" />; })()}
        {sorted.map((p) => (
          <g key={p.id}>
            <circle cx={x(p)} cy={20 + p.lane * H + 12} r={7} fill={p.bad ? 'var(--negative)' : 'var(--chart-1)'} />
            <text x={x(p)} y={20 + p.lane * H - 1} fontSize="10" textAnchor="middle" fill="var(--text)" fontWeight={600}>{p.label}</text>
            <text x={x(p)} y={20 + p.lane * H + 32} fontSize="9" textAnchor="middle" fill="var(--muted)">{clock(p.ts)}</text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] muted">Points are in time order (spacing is not to scale). Red marks an event flagged by a check or rejected by the regulator. The dashed line is the order&apos;s NEW event.</p>
    </div>
  );
}

function Order() {
  const id = useSearchParams().get('id') ?? '';
  const { data: d, error, loading } = useAsync(() => data.order(id), [id]);
  if (error) return <ErrorBox error={error} />;
  if (loading) return <Thinking label="Loading order" />;
  if (!d) return <Card><p className="text-sm">Order not found. <Link className="underline" href="/checks">Back to checks</Link></p></Card>;
  const o = d.order;
  const route = d.events.find((e) => e.event_type === 'ROUTE');

  return (
    <div className="space-y-5 stagger">
      <div>
        <Link href={`/checks?date=${o.trade_date}`} className="text-xs underline inline-flex items-center gap-1 muted"><ArrowLeft className="w-3 h-3" aria-hidden />Pre-submission checks</Link>
        <div className="flex items-start justify-between gap-3 flex-wrap mt-1">
          <div>
            <h1 className="page-title">Order {o.order_id}</h1>
            <p className="text-sm text-2 mt-1">{dayLong(o.trade_date)} · {o.source_system} · {o.desk} · {o.side} {o.quantity.toLocaleString()} {o.symbol} {o.order_type} · account {o.account_id}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {d.failures.map((f) => <Tag key={f.rule_id + f.record_id} tone="bad">{f.rule_id}</Tag>)}
            {d.feedback.map((f) => <Tag key={f.feedback_id} tone="warn">{f.error_code} {f.status}</Tag>)}
            <SourceBadge p={d} />
          </div>
        </div>
      </div>

      <Card title="Lifecycle timeline" right={<PoweredBy>Window functions</PoweredBy>}><Timeline d={d} /></Card>

      {route?.destination === 'NW-ATS' && (
        <Card title="Route linkage">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs muted">Firm route: routed order ID</div><div className="font-mono">{route.routed_order_id}</div></div>
            <div><div className="text-xs muted">ATS new order: routed order ID</div>
              <div className="font-mono" style={d.destEvents[0]?.routed_order_id !== route.routed_order_id ? { color: 'var(--negative)', fontWeight: 600 } : undefined}>{d.destEvents[0]?.routed_order_id ?? 'none'}</div></div>
          </div>
          {d.destEvents[0] && d.destEvents[0].routed_order_id !== route.routed_order_id && <p className="text-xs mt-2" style={{ color: 'var(--negative)' }}>The IDs differ, so the regulator can&apos;t link the route to the ATS order.</p>}
        </Card>
      )}

      <Card title="Events">
        <div className="overflow-x-auto relative">
          <table className="data-table">
            <thead><tr><th>Step</th><th>Event</th><th>Type</th><th>Event time</th><th>Qty</th><th>Price</th><th>Destination</th><th>Submitted</th></tr></thead>
            <tbody>
              {[...d.events, ...d.destEvents].sort((a, b) => a.step_seq - b.step_seq).map((e) => (
                <tr key={e.event_id}>
                  <td className="tabular text-xs">{e.step_seq}</td>
                  <td className="text-xs tabular">{e.event_id}</td>
                  <td className="text-xs font-medium">{e.event_type}</td>
                  <td className="text-xs tabular">{clock(e.event_ts)}</td>
                  <td className="text-xs tabular">{e.quantity.toLocaleString()}</td>
                  <td className="text-xs tabular">{e.price ?? '—'}</td>
                  <td className="text-xs">{e.destination ?? '—'}</td>
                  <td className="text-xs tabular">{e.submitted_ts ? `${e.submitted_ts.slice(5, 10)} ${clock(e.submitted_ts).slice(0, 5)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(d.failures.length > 0 || d.feedback.length > 0) && (
        <Card title="Findings">
          <ul className="text-sm space-y-1.5">
            {d.failures.map((f) => <li key={f.rule_id + f.record_id}><Tag tone="bad">{f.rule_id}</Tag> {f.record_id}: {Object.entries(f.detail).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}</li>)}
            {d.feedback.map((f) => <li key={f.feedback_id}><Tag tone="warn">{f.error_code}</Tag> {CODE_NAMES[f.error_code]}: {f.error_text}. Repair status {f.status}{f.assignee ? `, ${f.assignee}` : ''}. <Link className="underline" href="/rejects">Workbench</Link></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function OrderPage() {
  return <Suspense fallback={<Thinking label="Loading order" />}><Order /></Suspense>;
}
