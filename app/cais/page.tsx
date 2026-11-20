'use client';

// CAIS customers: regulator feedback on customer and account records. For inconsistent-customer rejects,
// AI_SIMILARITY finds the same person across accounts, the app proposes a canonical record field by
// field, and a person approves it.
import { CheckCircle2, Fingerprint, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { CODE_NAMES } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, StatusTag, Tag } from '@/components/Status';
import { Drawer, Empty, PageHeader, PageSkeleton, Panel, PoweredBy, SampleAiBadge, Segmented, SourceBadge } from '@/components/ui';
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const run = async () => {
    setBusy(true); setErr(undefined);
    try {
      const r = await data.match(issue.record_id);
      const auto = new Set([r.anchor.record_id, ...r.candidates.filter((c) => (c.score ?? 0) >= r.threshold).map((c) => c.record.record_id)]);
      setM(r); setPicked(auto);
      setCanon(propose([r.anchor, ...r.candidates.map((c) => c.record)].filter((x) => auto.has(x.record_id))));
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };
  const all = m ? [m.anchor, ...m.candidates.map((c) => c.record)] : [];
  const group = all.filter((r) => picked.has(r.record_id));
  const diff = conflicts(group);
  const toggle = (id: string) => {
    const next = new Set(picked); if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next); setCanon(propose(all.filter((x) => next.has(x.record_id))));
  };
  const approve = async () => {
    try {
      const r = await data.approveCanonical([...picked], canon!, note);
      setMsg({ ok: true, text: `Approved ${r.canonicalId}. The CA-13 rejects on these accounts are marked repaired and logged to Evidence.` }); onDone();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); }
  };

  return (
    <Panel eyebrow="Entity matching · CA-13" title={`${issue.record.name} across accounts`} right={m?.source === 'mock' ? <SampleAiBadge /> : m ? <SourceBadge p={m} /> : <PoweredBy>AI_SIMILARITY</PoweredBy>}>
      {!m && !busy && (
        <div className="flex items-start gap-4 flex-wrap">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--violet) 15%, transparent)', color: 'var(--violet)' }}><Fingerprint className="w-5 h-5" aria-hidden /></span>
          <div className="flex-1 min-w-[14rem]">
            <p className="text-[13px] text-2 mb-3">Find records for the same person by comparing name, date of birth and address with AI_SIMILARITY, among records that share the tax ID&apos;s last four digits.</p>
            <button className="btn btn-ai" onClick={run}><Sparkles className="w-4 h-4" style={{ color: 'var(--violet)' }} aria-hidden />Find matching records</button>
          </div>
        </div>
      )}
      {busy && <Reasoning kind="match" title="Matching the customer" steps={[`Reading record ${issue.record_id} on account ${issue.record.account_id}`, `Blocking on tax ID last four ••${issue.record.tin_last4}`, 'Scoring candidates with AI_SIMILARITY', 'Proposing a canonical record field by field']} />}
      {err && <p role="alert" className="text-sm" style={{ color: 'var(--coral)' }}>{err}</p>}
      {m && canon && (
        <div className="space-y-4 fade-up">
          <div className="scroller rounded-lg" style={{ border: '1px solid var(--line)' }}>
            <table className="tbl">
              <thead><tr><th>Use</th><th>Record · account</th><th>Similarity</th>{CANONICAL_FIELDS.map((f) => <th key={f}>{LABEL[f]}</th>)}<th>Opened</th></tr></thead>
              <tbody>
                {[{ record: m.anchor, score: null as number | null }, ...m.candidates].map(({ record: r, score }) => (
                  <tr key={r.record_id} className={picked.has(r.record_id) ? 'is-selected' : undefined}>
                    <td><input type="checkbox" aria-label={`Include ${r.record_id}`} checked={picked.has(r.record_id)} disabled={r.record_id === m.anchor.record_id} onChange={() => toggle(r.record_id)} /></td>
                    <td className="mono text-xs whitespace-nowrap">{r.record_id}<div className="muted">{r.account_id} · {r.account_type}</div></td>
                    <td>{score === null ? <Tag>Anchor</Tag> : (
                      <span className="flex items-center gap-2"><span className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }} aria-hidden><span className="block h-full" style={{ width: `${score * 100}%`, background: score >= m.threshold ? 'var(--mint)' : 'var(--muted)' }} /></span>
                        <span className="mono text-xs" style={{ color: score >= m.threshold ? 'var(--mint)' : 'var(--muted)' }}>{score.toFixed(3)}</span></span>)}</td>
                    {CANONICAL_FIELDS.map((f) => <td key={f} className="text-xs whitespace-nowrap" style={picked.has(r.record_id) && diff.includes(f) ? { color: 'var(--coral)', fontWeight: 600 } : undefined}>{String(r[f])}</td>)}
                    <td className="mono text-xs">{r.open_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] muted">Records scoring {m.threshold} or higher are preselected; a person confirms the group. Coral marks fields that disagree across the selected records.</p>

          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="flex items-center gap-2 flex-wrap mb-3"><span className="font-semibold text-sm">Proposed canonical record</span><Tag tone="ai">Proposal · needs approval</Tag>
              <span className="text-[11.5px] muted">Most common value per field; ties go to the newest account. Change any field.</span></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CANONICAL_FIELDS.map((f) => {
                const opts = [...new Set(group.map((r) => String(r[f])))];
                return (
                  <label key={f} className="text-xs muted">{LABEL[f]} {diff.includes(f) && <Tag tone="warn">conflict</Tag>}
                    <select className="input w-full mt-1" value={canon[f]} onChange={(e) => setCanon({ ...canon, [f]: e.target.value })} disabled={opts.length < 2}>
                      {opts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="text-xs muted flex-1 min-w-[14rem]">Approval note (required)
              <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How the values were confirmed, e.g. against the signed account application" />
            </label>
            <button className="btn btn-primary" disabled={!note.trim() || picked.size < 2 || !!msg?.ok} onClick={approve}><CheckCircle2 className="w-4 h-4" aria-hidden />Approve canonical record</button>
          </div>
          {msg && <p className="text-[13px] fade-up" role="status" style={{ color: msg.ok ? 'var(--mint)' : 'var(--coral)' }}>{msg.text}</p>}
        </div>
      )}
    </Panel>
  );
}

function SimpleRepair({ issue, onDone }: { issue: CaisIssue; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string>();
  const r = issue.record;
  const bad = (code: string) => (issue.error_code === code ? { color: 'var(--coral)', fontWeight: 600 } : undefined);
  return (
    <Panel eyebrow={`${issue.error_code} · ${r.record_id}`} title={CODE_NAMES[issue.error_code]}>
      <p className="text-[13px] text-2 mb-3">{issue.error_text}.</p>
      <dl className="grid sm:grid-cols-3 gap-3 mb-4">
        {[['Customer', `${r.name} (${r.customer_id})`, undefined], ['Account', `${r.account_id} · ${r.account_type}`, undefined],
          ['Large trader ID', r.large_trader_id ?? 'missing', bad('CA-11')], ['Address', `${r.address}, ${r.city} ${r.state} ${r.postal_code}`, bad('CA-12')]].map(([k, v, st]) => (
          <div key={String(k)} className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}><dt className="eyebrow !text-[9.5px]">{k as string}</dt><dd className="text-[13px] mt-1" style={st as never}>{v as string}</dd></div>
        ))}
      </dl>
      {issue.status === 'Repaired' ? <p className="text-[13px] flex gap-2 items-center"><StatusTag status="Repaired" />{issue.repair_note}</p> : (
        <div className="flex gap-2 flex-wrap items-end">
          <label className="text-xs muted flex-1 min-w-[14rem]">Repair note (required)
            <input className="input w-full mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was corrected in the source record" />
          </label>
          <button className="btn btn-primary" disabled={!note.trim()} onClick={async () => { try { await data.repair([issue.feedback_id], 'Repaired', '', note, false); setMsg('Marked repaired and logged.'); onDone(); } catch (e) { setMsg(String((e as Error).message)); } }}>Mark repaired</button>
          {msg && <span className="text-[13px]" role="status">{msg}</span>}
        </div>
      )}
    </Panel>
  );
}

export default function CaisPage() {
  const [reload, setReload] = useState(0);
  const [pick, setPick] = useState<string>();
  const [drawer, setDrawer] = useState(false);
  const [filter, setFilter] = useState<'all' | 'CA-11' | 'CA-12' | 'CA-13'>('all');
  const { data: d, error } = useAsync(() => data.cais(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading CAIS feedback" />;
  const list = d.issues.filter((i) => filter === 'all' || i.error_code === filter);
  const current = d.issues.find((i) => i.feedback_id === (pick ?? list[0]?.feedback_id));
  const done = () => setReload((r) => r + 1);
  const count = (c: string) => d.issues.filter((i) => i.error_code === c).length;

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="CAIS · customer and account records" title="One customer, one record"
        sub={<>{d.issues.length} rejects on the CAIS file of Oct 29, {d.issues.filter((i) => i.status !== 'Repaired').length} still open.</>} right={<SourceBadge p={d} />} />
      <div className="grid xl:grid-cols-[22rem_minmax(0,1fr)] gap-4 items-start">
        <Panel eyebrow="Feedback" title={`${list.length} rejects`}>
          <div className="mb-3"><Segmented label="Error code" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, ...(['CA-13', 'CA-11', 'CA-12'] as const).map((c) => ({ value: c, label: c, count: count(c) }))]} /></div>
          {list.length === 0 ? <Empty title="No rejects with this code" /> : (
            <ul className="space-y-1.5">
              {list.map((i) => {
                const on = i === current;
                return (
                  <li key={i.feedback_id}>
                    <button onClick={() => { setPick(i.feedback_id); setDrawer(true); }} aria-current={on ? 'true' : undefined}
                      className="w-full text-left rounded-lg px-3 py-2.5 hover-lift" style={{ border: `1px solid ${on ? 'var(--signal)' : 'var(--line)'}`, background: on ? 'color-mix(in srgb, var(--signal) 7%, var(--surface-2))' : 'var(--surface-2)' }}>
                      <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold"><span className="mono">{i.error_code}</span> {CODE_NAMES[i.error_code]}</span><StatusTag status={i.status} /></div>
                      <div className="text-[11.5px] muted mt-0.5">{i.record.name} · <span className="mono">{i.record.account_id}</span></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-4 min-w-0">
          {current && (
            <Drawer open={drawer} onClose={() => setDrawer(false)} title={`${current.error_code} · ${current.record.name}`}>
              {current.error_code === 'CA-13'
                ? (current.status === 'Repaired' ? <Panel eyebrow="CA-13" title={current.record.name}><p className="text-[13px] flex gap-2 items-center"><StatusTag status="Repaired" />{current.repair_note}</p></Panel> : <Matcher key={current.feedback_id} issue={current} onDone={done} />)
                : <SimpleRepair key={current.feedback_id} issue={current} onDone={done} />}
            </Drawer>
          )}
          {d.canonical.length > 0 && (
            <Panel eyebrow="Golden records" title="Approved canonical records">
              <ul className="space-y-2">{d.canonical.map((c) => (
                <li key={c.canonical_id} className="rounded-lg p-3 text-[13px]" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex gap-2 items-center flex-wrap"><Tag tone="good" mono>{c.canonical_id}</Tag><strong>{c.name}</strong><span className="muted">{c.dob} · {c.address}</span></div>
                  <div className="text-[11.5px] muted mt-1 mono">records {c.record_ids} · approved by {c.approved_by}</div>
                </li>))}</ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
