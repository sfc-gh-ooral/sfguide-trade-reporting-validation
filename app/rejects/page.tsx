'use client';

// Reject workbench: regulator feedback clustered by root cause, an AI explanation and suggested
// repair for each cluster, and assign / mark-repaired actions on one or many rejects.
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CODE_NAMES, day, n } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, Markdown, PoweredBy, SampleAiBadge, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Cluster, Explain } from '@/lib/types';

const TEAMS = ['Algo Platform Engineering', 'Options Technology', 'Reporting Operations', 'Client Data Operations'];

function ClusterPanel({ c, onDone }: { c: Cluster; onDone: () => void }) {
  const [ai, setAi] = useState<Explain>();
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string>();
  const [sel, setSel] = useState<Set<string>>(() => new Set(c.items.filter((i) => i.status !== 'Repaired').map((i) => i.feedback_id)));
  const [assignee, setAssignee] = useState(TEAMS[0]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();
  const [saving, setSaving] = useState(false);

  const explain = async () => {
    setBusy(true); setAiError(undefined);
    try { setAi(await data.explain(c.cluster_id)); } catch (e) { setAiError(String((e as Error).message)); } finally { setBusy(false); }
  };
  const act = async (action: 'Assign' | 'Repaired') => {
    setSaving(true); setMsg(undefined);
    try {
      const r = await data.repair([...sel], action, action === 'Assign' ? assignee : '', note, !!ai);
      setMsg(`${action === 'Assign' ? 'Assigned' : 'Marked repaired'}: ${r.updated} rejects. Logged to the evidence trail.`);
      setNote(''); onDone();
    } catch (e) { setMsg(String((e as Error).message)); } finally { setSaving(false); }
  };
  const toggle = (id: string) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  return (
    <div className="space-y-4 min-w-0">
      <Card title={`${c.error_code} ${CODE_NAMES[c.error_code]} · ${c.source_system} · ${c.desk}`}
        right={ai?.source === 'mock' ? <SampleAiBadge /> : ai ? <SourceBadge p={ai} /> : <><PoweredBy>Cortex Search</PoweredBy><PoweredBy>AI_COMPLETE</PoweredBy></>}>
        <p className="text-sm text-2 mb-3">{c.error_text}. {c.count} rejects across {c.trade_dates.map(day).join(', ')}. {c.caught} of {c.count} were also flagged by a pre-submission check.</p>
        {!ai && !busy && <button className="btn btn-ai" onClick={explain}><Sparkles className="w-4 h-4" aria-hidden />Explain and suggest a repair</button>}
        {busy && <Reasoning kind="explain" />}
        {aiError && <p role="alert" className="text-sm" style={{ color: 'var(--negative)' }}>{aiError}</p>}
        {ai && (
          <div className="ai-panel">
            <Markdown text={ai.text} />
            {ai.repair && <div className="mt-3"><div className="text-xs font-semibold mb-1">Suggested repair <Tag tone="info">AI suggestion</Tag></div><Markdown text={ai.repair} /></div>}
            <p className="text-[11px] muted mt-2">Sources (Cortex Search over the illustrative FAQ): {ai.sources.map((s) => s.title).join('; ')}. {ai.model ? `Model ${ai.model}. ` : ''}A person decides the repair.</p>
          </div>
        )}
      </Card>

      <Card title="Rejects in this cluster">
        <div className="overflow-x-auto relative max-h-[22rem]">
          <table className="data-table">
            <thead><tr><th><input type="checkbox" aria-label="Select all open" checked={c.items.filter((i) => i.status !== 'Repaired').every((i) => sel.has(i.feedback_id))}
              onChange={(e) => setSel(new Set(e.target.checked ? c.items.filter((i) => i.status !== 'Repaired').map((i) => i.feedback_id) : []))} /></th>
              <th>Feedback</th><th>Trade date</th><th>Order</th><th>Event</th><th>Caught</th><th>Status</th></tr></thead>
            <tbody>
              {c.items.map((f) => (
                <tr key={f.feedback_id}>
                  <td><input type="checkbox" aria-label={`Select ${f.feedback_id}`} disabled={f.status === 'Repaired'} checked={sel.has(f.feedback_id)} onChange={() => toggle(f.feedback_id)} /></td>
                  <td className="text-xs tabular">{f.feedback_id}</td>
                  <td className="text-xs">{day(f.trade_date)}</td>
                  <td><Link className="underline text-xs" href={`/order?id=${f.order_id}`}>{f.order_id}</Link></td>
                  <td className="text-xs tabular">{f.event_id}</td>
                  <td>{f.caught ? <Tag tone="good">Yes</Tag> : <Tag>No</Tag>}</td>
                  <td>{f.status === 'Repaired' ? <Tag tone="good">Repaired</Tag> : f.status === 'Assigned' ? <Tag tone="info">{f.assignee}</Tag> : <Tag tone="warn">Open</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid sm:grid-cols-[1fr_2fr] gap-3 mt-3">
          <label className="text-xs">Assign to
            <select className="input w-full mt-1" value={assignee} onChange={(e) => setAssignee(e.target.value)}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="text-xs">Repair note (required to mark repaired)
            <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was corrected and resubmitted" />
          </label>
        </div>
        <div className="flex gap-2 flex-wrap mt-3 items-center">
          <button className="btn" disabled={!sel.size || saving} onClick={() => act('Assign')}>Assign {sel.size}</button>
          <button className="btn btn-primary" disabled={!sel.size || saving || !note.trim()} onClick={() => act('Repaired')}>Mark {sel.size} repaired</button>
          {ai?.repair && !note && <button className="btn !py-1 text-xs" onClick={() => setNote(`Applied AI-suggested repair after review: ${ai.repair.replace(/\s+/g, ' ').slice(0, 180)}`)}>Use the suggested repair as the note</button>}
          {msg && <span className="text-sm" role="status">{msg}</span>}
        </div>
      </Card>
    </div>
  );
}

export default function RejectsPage() {
  const [reload, setReload] = useState(0);
  const [pick, setPick] = useState<string>();
  const { data: d, error } = useAsync(() => data.rejects(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Loading rejects" />;
  const current = d.clusters.find((c) => c.cluster_id === (pick ?? d.clusters[0]?.cluster_id));
  const open = d.clusters.reduce((a, c) => a + c.open + c.assigned, 0);

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Reject workbench</h1>
          <p className="text-sm text-2 mt-1">{n(d.total)} CAT rejects in October, {open} still open or assigned, grouped by error code, source system, and desk</p>
        </div>
        <SourceBadge p={d} />
      </div>
      <div className="grid lg:grid-cols-[22rem_1fr] gap-4 items-start [&>*]:min-w-0">
        <Card title="Root-cause clusters">
          <ul className="space-y-2">
            {d.clusters.map((c) => (
              <li key={c.cluster_id}>
                <button onClick={() => setPick(c.cluster_id)} aria-current={c === current ? 'true' : undefined}
                  className={`w-full text-left rounded-lg p-3 border card-hover ${c === current ? 'row-selected' : ''}`} style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{c.error_code} {CODE_NAMES[c.error_code]}</span>
                    {c.open + c.assigned ? <Tag tone="bad">{c.open + c.assigned} open</Tag> : <Tag tone="good">Repaired</Tag>}
                  </div>
                  <div className="text-xs muted mt-0.5">{c.source_system} · {c.desk} · {c.count} rejects · {c.trade_dates.length === 1 ? day(c.trade_dates[0]) : `${day(c.trade_dates[0])} to ${day(c.trade_dates.at(-1)!)}`}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {current && <ClusterPanel key={current.cluster_id} c={current} onDone={() => setReload((r) => r + 1)} />}
      </div>
    </div>
  );
}
