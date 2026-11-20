'use client';

// CAIS customers: regulator feedback on customer and account records. For inconsistent-customer
// rejects, AI_SIMILARITY finds the same person across accounts, the app proposes a canonical
// record field by field, and a person approves it.
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { CODE_NAMES } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SampleAiBadge, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { conflicts, propose } from '@/lib/build';
import { data } from '@/lib/client';
import { CANONICAL_FIELDS, type CaisIssue, type CanonicalField, type Match } from '@/lib/types';

const LABEL: Record<CanonicalField, string> = { customer_id: 'Customer ID', name: 'Name', dob: 'Date of birth', address: 'Address', city: 'City', state: 'State', postal_code: 'Postal code' };

function Matcher({ issue, onDone }: { issue: CaisIssue; onDone: () => void }) {
  const [m, setM] = useState<Match>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [canon, setCanon] = useState<Record<CanonicalField, string>>();
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();

  const run = async () => {
    setBusy(true); setErr(undefined);
    try {
      const r = await data.match(issue.record_id);
      const auto = new Set([r.anchor.record_id, ...r.candidates.filter((c) => (c.score ?? 0) >= r.threshold).map((c) => c.record.record_id)]);
      setM(r); setPicked(auto);
      setCanon(propose([r.anchor, ...r.candidates.map((c) => c.record)].filter((x) => auto.has(x.record_id))));
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const group = m ? [m.anchor, ...m.candidates.map((c) => c.record)].filter((r) => picked.has(r.record_id)) : [];
  const diff = conflicts(group);
  const toggle = (id: string) => {
    const next = new Set(picked); if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
    if (m) setCanon(propose([m.anchor, ...m.candidates.map((c) => c.record)].filter((x) => next.has(x.record_id))));
  };
  const approve = async () => {
    try {
      const r = await data.approveCanonical([...picked], canon!, note);
      setMsg(`Approved ${r.canonicalId}. The CA-13 rejects on these accounts are marked repaired and logged.`); onDone();
    } catch (e) { setMsg(String((e as Error).message)); }
  };

  return (
    <Card title={`Match ${issue.record.name} across accounts`} right={m?.source === 'mock' ? <SampleAiBadge /> : m ? <SourceBadge p={m} /> : <PoweredBy>AI_SIMILARITY</PoweredBy>}>
      {!m && !busy && (
        <div>
          <p className="text-sm text-2 mb-3">Find records for the same person by comparing name, date of birth, and address with AI_SIMILARITY, within records that share the tax ID&apos;s last four digits.</p>
          <button className="btn btn-ai" onClick={run}><Sparkles className="w-4 h-4" aria-hidden />Find matching records</button>
        </div>
      )}
      {busy && <Reasoning kind="match" />}
      {err && <p role="alert" className="text-sm" style={{ color: 'var(--negative)' }}>{err}</p>}
      {m && canon && (
        <div className="space-y-4">
          <div className="overflow-x-auto relative">
            <table className="data-table">
              <thead><tr><th>Use</th><th>Record · account</th><th>Similarity</th>{CANONICAL_FIELDS.map((f) => <th key={f}>{LABEL[f]}</th>)}<th>Opened</th></tr></thead>
              <tbody>
                {[{ record: m.anchor, score: null as number | null }, ...m.candidates].map(({ record: r, score }) => (
                  <tr key={r.record_id}>
                    <td><input type="checkbox" aria-label={`Include ${r.record_id}`} checked={picked.has(r.record_id)} disabled={r.record_id === m.anchor.record_id} onChange={() => toggle(r.record_id)} /></td>
                    <td className="text-xs tabular">{r.record_id}<div className="muted">{r.account_id} · {r.account_type}</div></td>
                    <td className="tabular text-xs">{score === null ? <Tag>Anchor</Tag> : score >= m.threshold ? <Tag tone="good">{score.toFixed(3)}</Tag> : <Tag>{score.toFixed(3)}</Tag>}</td>
                    {CANONICAL_FIELDS.map((f) => <td key={f} className="text-xs" style={picked.has(r.record_id) && diff.includes(f) ? { color: 'var(--negative)', fontWeight: 600 } : undefined}>{String(r[f])}</td>)}
                    <td className="text-xs tabular">{r.open_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs muted">Records scoring {m.threshold} or higher are preselected. Red marks fields that disagree across the selected records.</p>

          <div>
            <div className="text-sm font-semibold mb-2">Proposed canonical record <span className="text-xs muted font-normal">(most common value; ties go to the newest account; change any field)</span></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CANONICAL_FIELDS.map((f) => {
                const opts = [...new Set(group.map((r) => String(r[f])))];
                return (
                  <label key={f} className="text-xs">{LABEL[f]} {diff.includes(f) && <Tag tone="warn">conflict</Tag>}
                    <select className="input w-full mt-1" value={canon[f]} onChange={(e) => setCanon({ ...canon, [f]: e.target.value })} disabled={opts.length < 2}>
                      {opts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="text-xs flex-1 min-w-[16rem]">Approval note (required)
              <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How the values were confirmed, e.g. against the signed account application" />
            </label>
            <button className="btn btn-primary" disabled={!note.trim() || picked.size < 2 || !!msg} onClick={approve}>Approve canonical record</button>
          </div>
          {msg && <p className="text-sm" role="status" style={{ color: 'var(--positive)' }}>{msg}</p>}
        </div>
      )}
    </Card>
  );
}

function SimpleRepair({ issue, onDone }: { issue: CaisIssue; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();
  const r = issue.record;
  return (
    <Card title={`${issue.error_code} ${CODE_NAMES[issue.error_code]} · ${r.record_id}`}>
      <p className="text-sm text-2 mb-2">{issue.error_text}.</p>
      <table className="data-table mb-3"><tbody>
        <tr><td className="text-xs muted">Customer</td><td className="text-sm">{r.name} ({r.customer_id}) · {r.account_id} {r.account_type}</td></tr>
        <tr><td className="text-xs muted">Address</td><td className="text-sm" style={issue.error_code === 'CA-12' ? { color: 'var(--negative)', fontWeight: 600 } : undefined}>{r.address}, {r.city} {r.state} {r.postal_code}</td></tr>
        <tr><td className="text-xs muted">Large trader ID</td><td className="text-sm" style={issue.error_code === 'CA-11' ? { color: 'var(--negative)', fontWeight: 600 } : undefined}>{r.large_trader_id ?? 'missing'}</td></tr>
      </tbody></table>
      {issue.status === 'Repaired' ? <p className="text-sm"><Tag tone="good">Repaired</Tag> {issue.repair_note}</p> : (
        <div className="flex gap-2 flex-wrap items-end">
          <label className="text-xs flex-1 min-w-[16rem]">Repair note (required)
            <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was corrected in the source record" />
          </label>
          <button className="btn btn-primary" disabled={!note.trim()} onClick={async () => { try { await data.repair([issue.feedback_id], 'Repaired', '', note, false); setMsg('Marked repaired and logged.'); onDone(); } catch (e) { setMsg(String((e as Error).message)); } }}>Mark repaired</button>
          {msg && <span className="text-sm" role="status">{msg}</span>}
        </div>
      )}
    </Card>
  );
}

export default function CaisPage() {
  const [reload, setReload] = useState(0);
  const [pick, setPick] = useState<string>();
  const { data: d, error } = useAsync(() => data.cais(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Loading CAIS feedback" />;
  const current = d.issues.find((i) => i.feedback_id === (pick ?? d.issues[0]?.feedback_id));
  const done = () => setReload((r) => r + 1);

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">CAIS customers</h1>
          <p className="text-sm text-2 mt-1">{d.issues.length} rejects on the CAIS file of Oct 29, {d.issues.filter((i) => i.status !== 'Repaired').length} still open</p>
        </div>
        <SourceBadge p={d} />
      </div>
      <div className="grid lg:grid-cols-[20rem_1fr] gap-4 items-start [&>*]:min-w-0">
        <Card title="Feedback">
          <ul className="space-y-1.5">
            {d.issues.map((i) => (
              <li key={i.feedback_id}>
                <button onClick={() => setPick(i.feedback_id)} aria-current={i === current ? 'true' : undefined}
                  className={`w-full text-left rounded-lg px-3 py-2 border ${i === current ? 'row-selected' : ''}`} style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{i.error_code} {CODE_NAMES[i.error_code]}</span>
                    {i.status === 'Repaired' ? <Tag tone="good">Repaired</Tag> : <Tag tone="warn">Open</Tag>}
                  </div>
                  <div className="text-xs muted">{i.record.name} · {i.record.account_id}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4 min-w-0">
          {current && (current.error_code === 'CA-13'
            ? (current.status === 'Repaired' ? <Card title={`${current.record.name}`}><p className="text-sm"><Tag tone="good">Repaired</Tag> {current.repair_note}</p></Card> : <Matcher key={current.feedback_id} issue={current} onDone={done} />)
            : <SimpleRepair key={current.feedback_id} issue={current} onDone={done} />)}
          {d.canonical.length > 0 && (
            <Card title="Approved canonical records">
              <ul className="text-sm space-y-1">{d.canonical.map((c) => <li key={c.canonical_id}><strong>{c.canonical_id}</strong> {c.name}, {c.dob}, {c.address} · records {c.record_ids} · approved by {c.approved_by}</li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
