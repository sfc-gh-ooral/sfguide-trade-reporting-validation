'use client';

// One order's lifecycle as an event timeline: firm events, the ATS's destination event, the fills in
// the books, and every check failure and regulator reject that touches the order.
import { ArrowLeft, Link2, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CODE_NAMES, clock, dayLong } from '@/components/fmt';
import { ErrorBox, StatusTag, Tag } from '@/components/Status';
import { Empty, PageHeader, PageSkeleton, Panel, PoweredBy, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { OrderTimeline } from '@/lib/types';

const ms = (t: string) => Date.parse(`${t.slice(0, 23)}Z`);
const LANES = ['Firm · CAT feed', 'Destination ATS', 'Books'];

/** Swimlanes in time order. Spacing is by rank so millisecond gaps stay readable; the real time is labeled. */
function Timeline({ d }: { d: OrderTimeline }) {
  const [hover, setHover] = useState<string>();
  const bad = new Set(d.failures.map((f) => f.record_id).concat(d.feedback.map((f) => f.event_id)));
  const pts = [
    ...d.events.map((e) => ({ lane: 0, id: e.event_id, label: e.event_type, t: ms(e.event_ts), ts: e.event_ts, bad: bad.has(e.event_id), sub: e.destination ? `→ ${e.destination}` : `${e.quantity.toLocaleString()} @ ${e.price ?? 'mkt'}` })),
    ...d.destEvents.map((e) => ({ lane: 1, id: e.event_id, label: 'NEW (ATS)', t: ms(e.event_ts), ts: e.event_ts, bad: false, sub: e.routed_order_id ?? '' })),
    ...d.executions.map((x) => ({ lane: 2, id: x.execution_id, label: 'FILL', t: ms(x.exec_ts), ts: x.exec_ts, bad: bad.has(x.execution_id), sub: `${x.quantity.toLocaleString()} @ ${x.price}` })),
  ].sort((a, b) => a.t - b.t || a.lane - b.lane);
  const newEv = d.events.find((e) => e.event_type === 'NEW');
  const W = 820, L = 128, R = 40, LH = 66, TOP = 26;
  const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R);
  const y = (lane: number) => TOP + lane * LH + 18;
  const newIdx = pts.findIndex((p) => p.id === newEv?.event_id);
  const hp = pts.find((p) => p.id === hover);
  return (
    <div className="scroller">
      <div className="relative min-w-[640px]">
      <svg viewBox={`0 0 ${W} ${TOP + LH * 3 + 6}`} className="w-full" role="img"
        aria-label={`Timeline of ${pts.length} events in time order. ${pts.filter((p) => p.bad).map((p) => `${p.label} ${p.id} at ${clock(p.ts)} is flagged`).join('. ') || 'No events flagged.'}`}>
        {LANES.map((l, i) => (
          <g key={l}>
            <rect x={L - 16} y={TOP + i * LH} width={W - L - R + 32} height={LH - 10} rx={8} fill="var(--surface-2)" opacity={0.6} />
            <text x={0} y={y(i) + 4} fontSize="11" fill="var(--muted)" fontFamily="var(--font-plex-mono)">{l}</text>
          </g>
        ))}
        {newIdx >= 0 && <g><line x1={x(newIdx)} x2={x(newIdx)} y1={8} y2={TOP + LH * 3 - 8} stroke="var(--signal)" strokeDasharray="3 4" />
          <text x={x(newIdx)} y={14} fontSize="10" textAnchor="middle" fill="var(--signal)" fontFamily="var(--font-plex-mono)">order NEW</text></g>}
        {pts.slice(1).map((p, i) => <line key={`l${p.id}`} x1={x(i)} y1={y(pts[i].lane)} x2={x(i + 1)} y2={y(p.lane)} stroke="var(--line-strong)" strokeWidth={1.2} />)}
        {pts.map((p, i) => (
          <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(undefined)} onClick={() => setHover(p.id)} style={{ cursor: 'default' }}>
            {p.bad && <circle cx={x(i)} cy={y(p.lane)} r={13} fill="var(--coral)" opacity={0.18} />}
            <circle cx={x(i)} cy={y(p.lane)} r={7} fill={p.bad ? 'var(--coral)' : p.lane === 1 ? 'var(--violet)' : p.lane === 2 ? 'var(--mint)' : 'var(--ice)'} stroke="var(--surface)" strokeWidth={2} />
            <text x={x(i)} y={y(p.lane) - 13} fontSize="10.5" textAnchor="middle" fill="var(--text)" fontWeight={600} fontFamily="var(--font-plex-mono)">{p.label}</text>
            <text x={x(i)} y={y(p.lane) + 22} fontSize="9.5" textAnchor="middle" fill={p.bad ? 'var(--coral)' : 'var(--muted)'} fontFamily="var(--font-plex-mono)">{clock(p.ts)}</text>
          </g>
        ))}
      </svg>
      {hp && (() => { const i = pts.indexOf(hp), px = (x(i) / W) * 100; return (
        <div role="tooltip" className="absolute pointer-events-none whitespace-nowrap mono text-[11px] px-2 py-1 rounded-md border"
          style={{ left: `${px}%`, top: `${((y(hp.lane) + 30) / (TOP + LH * 3 + 6)) * 100}%`, transform: `translateX(${px > 75 ? '-100%' : px < 25 ? '0' : '-50%'})`, background: 'var(--surface)', borderColor: hp.bad ? 'var(--coral)' : 'var(--line-strong)', color: 'var(--text)', zIndex: 2 }}>
          {hp.id} · {hp.label} · {clock(hp.ts)}{hp.sub ? ` · ${hp.sub}` : ''}{hp.bad ? ' · flagged' : ''}
        </div>); })()}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap text-[11.5px] muted mt-1">
        <span>{hp ? <span className="mono" style={{ color: 'var(--text)' }}>{hp.id} · {hp.label} · {clock(hp.ts)} · {hp.sub}</span> : 'Hover an event for details. Spacing shows order, not elapsed time.'}</span>
        <span className="flex gap-3"><span><span style={{ color: 'var(--coral)' }}>●</span> flagged or rejected</span><span><span style={{ color: 'var(--signal)' }}>┊</span> the order&apos;s NEW event</span></span>
      </div>
    </div>
  );
}

function Order() {
  const id = useSearchParams().get('id') ?? '';
  const { data: d, error, loading } = useAsync(() => data.order(id), [id]);
  if (error) return <ErrorBox error={error} />;
  if (loading) return <PageSkeleton label="Loading order" />;
  if (!d) return <Panel><Empty title="Order not found">Open an order from a failing record in <Link className="underline" href="/checks">Checks</Link> or a reject in the <Link className="underline" href="/rejects">workbench</Link>.</Empty></Panel>;
  const o = d.order;
  const route = d.events.find((e) => e.event_type === 'ROUTE');
  const dest = d.destEvents[0];
  const linked = !!dest && dest.routed_order_id === route?.routed_order_id;

  return (
    <div className="space-y-5 stagger">
      <div>
        <Link href={`/checks?date=${o.trade_date}`} className="text-xs inline-flex items-center gap-1 muted no-underline hover:underline"><ArrowLeft className="w-3 h-3" aria-hidden />Checks for {o.trade_date}</Link>
        <div className="mt-2"><PageHeader eyebrow="Order lifecycle" title={o.order_id}
          sub={<span className="mono text-[13px]">{dayLong(o.trade_date)} · {o.source_system} · {o.desk} · {o.side} {o.quantity.toLocaleString()} {o.symbol} {o.order_type} · acct {o.account_id}</span>}
          right={<>{d.failures.map((f) => <Tag key={f.rule_id + f.record_id} tone="bad" mono>{f.rule_id}</Tag>)}
            {d.feedback.map((f) => <Tag key={f.feedback_id} tone="warn" mono>{f.error_code} · {f.status}</Tag>)}<SourceBadge p={d} /></>} /></div>
      </div>

      <Panel eyebrow="Event timeline" title="How this order moved" right={<PoweredBy>Window functions</PoweredBy>}><Timeline d={d} /></Panel>

      <div className="grid lg:grid-cols-5 gap-4">
        {route?.destination === 'NW-ATS' && (
          <Panel className="lg:col-span-2" eyebrow="Route linkage · R-LNK-01" title={linked ? 'Route links to the ATS order' : 'Route does not link'}>
            <div className="grid gap-3">
              {[['Firm ROUTE · routed order ID', route.routed_order_id], ['ATS NEW · routed order ID', dest?.routed_order_id ?? 'no ATS event']].map(([k, v], i) => (
                <div key={k} className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: `1px solid ${!linked && i === 1 ? 'color-mix(in srgb, var(--coral) 50%, transparent)' : 'var(--line)'}` }}>
                  <div className="eyebrow !text-[10px]">{k}</div>
                  <div className="mono text-[16px] font-medium mt-1 break-all" style={!linked && i === 1 ? { color: 'var(--coral)' } : undefined}>{v}</div>
                </div>
              ))}
            </div>
            <p className="text-[13px] mt-3 flex gap-2 items-start" style={{ color: linked ? 'var(--mint)' : 'var(--coral)' }}>
              {linked ? <Link2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <Link2Off className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
              {linked ? 'IDs match, so the regulator can link the route to the ATS order.' : 'The IDs differ, so the regulator can\u2019t link the route to the ATS order. Compare the prefixes.'}
            </p>
          </Panel>
        )}
        <Panel className={route?.destination === 'NW-ATS' ? 'lg:col-span-3' : 'lg:col-span-5'} eyebrow="Findings" title={`${d.failures.length} check failures · ${d.feedback.length} regulator rejects`}>
          {d.failures.length + d.feedback.length === 0 ? <Empty title="Clean order">No check failed and the regulator returned no feedback for this order.</Empty> : (
            <ul className="space-y-2">
              {d.failures.map((f) => (
                <li key={f.rule_id + f.record_id} className="rounded-lg p-3 text-[13px]" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex gap-2 items-center flex-wrap mb-1"><Tag tone="bad" mono>{f.rule_id}</Tag><span className="mono text-xs muted">{f.record_id}</span></div>
                  <div className="mono text-xs text-2 break-words">{Object.entries(f.detail).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}</div>
                </li>
              ))}
              {d.feedback.map((f) => (
                <li key={f.feedback_id} className="rounded-lg p-3 text-[13px] flex items-center gap-2 flex-wrap" style={{ background: 'var(--surface-2)' }}>
                  <Tag tone="warn" mono>{f.error_code}</Tag><span>{CODE_NAMES[f.error_code]}: {f.error_text}</span><StatusTag status={f.status} assignee={f.assignee} />
                  <Link className="underline text-xs ml-auto" href="/rejects">Open in workbench</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="Reporting feed" title="Events as reported" pad={false}>
        <div className="scroller">
          <table className="tbl">
            <thead><tr><th>Step</th><th>Event</th><th>Type</th><th>Event time</th><th>Qty</th><th>Price</th><th>Destination</th><th>Routed ID</th><th>Submitted</th></tr></thead>
            <tbody>
              {[...d.events, ...d.destEvents].sort((a, b) => a.step_seq - b.step_seq).map((e) => {
                const flagged = d.failures.some((f) => f.record_id === e.event_id) || d.feedback.some((f) => f.event_id === e.event_id);
                return (
                  <tr key={e.event_id} className={flagged ? 'is-selected' : undefined}>
                    <td className="mono text-xs">{e.step_seq}</td>
                    <td className="mono text-xs">{e.event_id}</td>
                    <td className="mono text-xs font-medium">{e.event_type}</td>
                    <td className="mono text-xs" style={flagged ? { color: 'var(--coral)' } : undefined}>{clock(e.event_ts)}</td>
                    <td className="mono text-xs">{e.quantity.toLocaleString()}</td>
                    <td className="mono text-xs">{e.price ?? '—'}</td>
                    <td className="mono text-xs">{e.destination ?? '—'}</td>
                    <td className="mono text-xs">{e.routed_order_id ?? '—'}</td>
                    <td className="mono text-xs">{e.submitted_ts ? `${e.submitted_ts.slice(5, 10)} ${clock(e.submitted_ts).slice(0, 5)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export default function OrderPage() {
  return <Suspense fallback={<PageSkeleton label="Loading order" />}><Order /></Suspense>;
}
