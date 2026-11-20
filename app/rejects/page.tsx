'use client';

// Reject workbench: regulator feedback clustered by root cause, an AI explanation and suggested repair
// for each cluster (Cortex Search over the illustrative FAQ + AI_COMPLETE), and assign / mark-repaired
// actions on one or many rejects. A person decides every repair.
import { BookOpen, CheckCheck, Search, Sparkles, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CODE_COLORS, CODE_NAMES, day, n } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, StatusTag, Tag } from '@/components/Status';
import { Drawer, Empty, Markdown, PageHeader, PageSkeleton, Panel, PoweredBy, SampleAiBadge, Segmented, SourceBadge, StreamText } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';
import type { Cluster, Explain } from '@/lib/types';

const TEAMS = ['Algo Platform Engineering', 'Options Technology', 'Reporting Operations', 'Client Data Operations'];

function ClusterPanel({ c, onDone }: { c: Cluster; onDone: () => void }) {
  const [ai, setAi] = useState<Explain>();
  const [streamed, setStreamed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string>();
  const openIds = c.items.filter((i) => i.status !== 'Repaired').map((i) => i.feedback_id);
  const [sel, setSel] = useState<Set<string>>(() => new Set(openIds));
  const [assignee, setAssignee] = useState(c.source_system === 'ALGO-X' ? TEAMS[0] : c.source_system === 'OMS-B' ? TEAMS[1] : TEAMS[2]);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [saving, setSaving] = useState(false);

  const explain = async () => {
    setBusy(true); setAiError(undefined); setStreamed(false);
    try { setAi(await data.explain(c.cluster_id)); } catch (e) { setAiError(String((e as Error).message)); } finally { setBusy(false); }
  };
  const act = async (action: 'Assign' | 'Repaired') => {
    setSaving(true); setMsg(undefined);
    try {
      const r = await data.repair([...sel], action, action === 'Assign' ? assignee : '', note, !!ai);
      setMsg({ ok: true, text: `${action === 'Assign' ? `Assigned to ${assignee}` : 'Marked repaired'}: ${r.updated} rejects. Logged to the evidence trail.` });
      setNote(''); onDone();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setSaving(false); }
  };
  const toggle = (id: string) => setSel((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const dates = c.trade_dates.length === 1 ? day(c.trade_dates[0]) : `${day(c.trade_dates[0])} to ${day(c.trade_dates.at(-1)!)}`;

  return (
    <div className="space-y-4 min-w-0">
      <Panel eyebrow={`Root cause · ${c.source_system} · ${c.desk}`} title={`${c.error_code} ${CODE_NAMES[c.error_code]}`}
        right={ai?.source === 'mock' ? <SampleAiBadge /> : ai ? <SourceBadge p={ai} /> : <><PoweredBy>Cortex Search</PoweredBy><PoweredBy>AI_COMPLETE</PoweredBy></>}>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[['Rejects', c.count], ['Still open', c.open + c.assigned], ['Caught by a check', c.caught]].map(([k, v]) => (
            <div key={k} className="rounded-lg p-2.5" style={{ background: 'var(--surface-2)' }}><div className="eyebrow !text-[9.5px]">{k}</div><div className="mono text-lg font-semibold">{v}</div></div>
          ))}
        </div>
        <p className="text-[13px] text-2 mb-4">{c.error_text}. Trade dates {dates}.</p>
        {!ai && !busy && <button className="btn btn-ai" onClick={explain}><Sparkles className="w-4 h-4" style={{ color: 'var(--violet)' }} aria-hidden />Explain and suggest a repair</button>}
        {busy && <Reasoning kind="explain" title="Explaining the cluster" steps={[
          `Reading ${c.count} rejects from ${c.source_system} · ${c.desk}`,
          'Pulling three example records and their check results',
          `Searching the reporting FAQ for ${c.error_code} with Cortex Search`,
          'Drafting the explanation and repair with AI_COMPLETE']} />}
        {aiError && <p role="alert" className="text-sm" style={{ color: 'var(--coral)' }}>{aiError}</p>}
        {ai && (
          <div className="ai-panel fade-up">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap"><span className="eyebrow !text-[10.5px]" style={{ color: 'var(--violet)' }}>What happened</span>
              {ai.source === 'snowflake' && <span className="mono text-[11px] muted">{ai.model} · {ai.latencyMs?.toLocaleString()} ms</span>}</div>
            <StreamText text={ai.text} onDone={() => setStreamed(true)} />
            {streamed && ai.repair && (
              <div className="mt-4 fade-up">
                <div className="flex items-center gap-2 mb-1"><span className="eyebrow !text-[10.5px]" style={{ color: 'var(--violet)' }}>Suggested repair</span><Tag tone="ai">AI suggestion · needs review</Tag></div>
                <Markdown text={ai.repair} />
              </div>
            )}
            {streamed && (
              <div className="mt-4 fade-up">
                <div className="eyebrow !text-[10px] mb-1.5">Sources · Cortex Search over the illustrative FAQ</div>
                <div className="flex gap-2 flex-wrap">{ai.sources.map((s, i) => (
                  <span key={s.title} className="pill" style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--text-2)' }}>
                    <BookOpen className="w-3 h-3" aria-hidden /><span className="mono">[{i + 1}]</span> {s.title}{s.error_code ? ` · ${s.error_code}` : ''}</span>))}</div>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel eyebrow="Bulk actions" title={`Rejects in this cluster · ${sel.size} selected`} pad={false}>
        <div className="scroller max-h-[20rem]">
          <table className="tbl">
            <thead><tr><th><input type="checkbox" aria-label="Select all open" checked={openIds.length > 0 && openIds.every((i) => sel.has(i))}
              onChange={(e) => setSel(new Set(e.target.checked ? openIds : []))} /></th>
              <th>Feedback</th><th>Trade date</th><th>Order</th><th>Event</th><th>Caught</th><th>Status</th></tr></thead>
            <tbody>
              {c.items.map((f) => (
                <tr key={f.feedback_id} className={sel.has(f.feedback_id) ? 'is-selected' : undefined}>
                  <td><input type="checkbox" aria-label={`Select ${f.feedback_id}`} disabled={f.status === 'Repaired'} checked={sel.has(f.feedback_id)} onChange={() => toggle(f.feedback_id)} /></td>
                  <td className="mono text-xs">{f.feedback_id}</td>
                  <td className="mono text-xs">{f.trade_date.slice(5)}</td>
                  <td><Link className="mono text-xs underline decoration-dotted underline-offset-2" href={`/order?id=${f.order_id}`}>{f.order_id}</Link></td>
                  <td className="mono text-xs">{f.event_id}</td>
                  <td>{f.caught ? <Tag tone="good">Yes</Tag> : <Tag>No</Tag>}</td>
                  <td><StatusTag status={f.status} assignee={f.assignee} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--line)' }}>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <label className="text-xs muted">Assign to
              <select className="input w-full mt-1" value={assignee} onChange={(e) => setAssignee(e.target.value)}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="text-xs muted">Repair note (required to mark repaired)
              <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was corrected and resubmitted" />
            </label>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button className="btn" disabled={!sel.size || saving} onClick={() => act('Assign')}><UserPlus className="w-4 h-4" aria-hidden />Assign {sel.size}</button>
            <button className="btn btn-primary" disabled={!sel.size || saving || !note.trim()} onClick={() => act('Repaired')}><CheckCheck className="w-4 h-4" aria-hidden />Mark {sel.size} repaired</button>
            {ai?.repair && !note && <button className="btn btn-sm btn-ai" onClick={() => setNote(`Applied the AI-suggested repair after review: ${ai.repair.replace(/\s+/g, ' ').slice(0, 180)}`)}>Use the suggested repair as the note</button>}
          </div>
          {msg && <p className="text-[13px] fade-up" role="status" style={{ color: msg.ok ? 'var(--mint)' : 'var(--coral)' }}>{msg.text}</p>}
        </div>
      </Panel>
    </div>
  );
}

export default function RejectsPage() {
  const [reload, setReload] = useState(0);
  const [pick, setPick] = useState<string>();
  const [drawer, setDrawer] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const { data: d, error } = useAsync(() => data.rejects(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading rejects" />;
  const list = d.clusters.filter((c) => (filter === 'all' || c.open + c.assigned > 0) && (!q || `${c.error_code} ${c.source_system} ${c.desk} ${CODE_NAMES[c.error_code]}`.toLowerCase().includes(q.toLowerCase())));
  const current = d.clusters.find((c) => c.cluster_id === (pick ?? list[0]?.cluster_id));
  const open = d.clusters.reduce((a, c) => a + c.open + c.assigned, 0);
  const max = Math.max(...d.clusters.map((c) => c.count));

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="Reject workbench · CAT feedback" title="Work rejects by root cause, not one by one"
        sub={<>{n(d.total)} rejects in October, {open} open or assigned, grouped by error code, source system and desk.</>} right={<SourceBadge p={d} />} />
      <div className="grid xl:grid-cols-[24rem_minmax(0,1fr)] gap-4 items-start">
        <Panel eyebrow="Root-cause clusters" title={`${list.length} shown`} right={<Segmented label="Show" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} />}>
          <label className="relative block mb-3"><span className="sr-only">Search clusters</span>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 muted" aria-hidden />
            <input className="input !pl-8 w-full" placeholder="Code, system or desk" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {list.length === 0 ? <Empty icon={<CheckCheck className="w-5 h-5" />} title="Nothing open">Every cluster is repaired. Switch to All to review them.</Empty> : (
            <ul className="space-y-2">
              {list.map((c) => {
                const on = c === current;
                return (
                  <li key={c.cluster_id}>
                    <button onClick={() => { setPick(c.cluster_id); setDrawer(true); }} aria-current={on ? 'true' : undefined}
                      className="w-full text-left rounded-lg p-3 hover-lift" style={{ border: `1px solid ${on ? 'var(--signal)' : 'var(--line)'}`, background: on ? 'color-mix(in srgb, var(--signal) 7%, var(--surface-2))' : 'var(--surface-2)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: CODE_COLORS[c.error_code] }} aria-hidden />
                          <span className="mono text-[13px] font-semibold">{c.error_code}</span><span className="text-[13px] truncate">{CODE_NAMES[c.error_code]}</span></span>
                        {c.open + c.assigned ? <Tag tone="bad" mono>{c.open + c.assigned} open</Tag> : <Tag tone="good">Repaired</Tag>}
                      </div>
                      <div className="text-[11.5px] muted mono mt-1 truncate">{c.source_system} · {c.desk} · {c.trade_dates.length === 1 ? day(c.trade_dates[0]) : `${day(c.trade_dates[0])}–${day(c.trade_dates.at(-1)!)}`}</div>
                      <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--bg)' }} aria-hidden>
                        <div className="h-full flex"><span style={{ width: `${(100 * c.repaired) / max}%`, background: 'var(--mint)' }} /><span style={{ width: `${(100 * (c.open + c.assigned)) / max}%`, background: CODE_COLORS[c.error_code] }} /></div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        {current && (
          <Drawer open={drawer} onClose={() => setDrawer(false)} title={`${current.error_code} · ${current.source_system}`}>
            <ClusterPanel key={current.cluster_id} c={current} onDone={() => setReload((r) => r + 1)} />
          </Drawer>
        )}
      </div>
    </div>
  );
}
