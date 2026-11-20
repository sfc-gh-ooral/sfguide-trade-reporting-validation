// Sample mode: lib/sample/data.json, captured from a live run of sql/setup.sql (scripts/capture-sample.mjs).
// AI outputs are the ones Cortex returned in that run, and every screen labels them "Sample AI response".
// Repairs, approvals, and manual check runs are kept in memory for the session only.
import raw from './sample/data.json';
import { clusters, deadline } from './build';
import type { TrvData } from './trv-data';
import { SAMPLE_DELAY_MS, jitter } from './sample-timing';
import type { Anomalies, Approval, Cais, Canonical, CheckRecords, Checks, Evidence, Explain, Feedback, Health, Match, OrderTimeline, Rejects, RepairStatus, RunLogRow } from './types';

interface Sample {
  health: Health; checks: Record<string, Checks>; checkRecords: Record<string, CheckRecords>; orders: Record<string, OrderTimeline>;
  rejects: Rejects; explain: Record<string, Explain>; cais: Cais; match: Record<string, Match>; anomalies: Anomalies; evidence: Evidence;
}
const S = raw as unknown as Sample;
const ACTOR = 'SAMPLE_USER';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mock = { source: 'mock' as const };
const strip = <T extends object>(o: T): T => { const { source: _s, role: _r, latencyMs: _l, ...rest } = o as T & { source?: unknown; role?: unknown; latencyMs?: unknown }; void _s; void _r; void _l; return rest as T; };

const repairs = new Map<string, { status: RepairStatus; assignee: string | null; repair_note: string | null; updated_by: string; updated_ts: string }>();
const approvals: Approval[] = [];
const canonical: Canonical[] = [];
const runs: RunLogRow[] = [];
const withRepairs = <T extends { feedback_id: string }>(f: T): T => ({ ...f, ...(repairs.get(f.feedback_id) ?? {}) });
const allFeedback = (): Feedback[] => S.rejects.clusters.flatMap((c) => c.items).map(withRepairs);
const caisIssues = () => S.cais.issues.map(withRepairs);
const log = (action: string, object_type: string, ids: string[], detail: string, ai_assisted: boolean) =>
  approvals.unshift({ action, object_type, object_ids: ids.join(', '), detail, ai_assisted, actor: ACTOR, ts: new Date().toISOString() });

export const mockData: TrvData = {
  async health() {
    const fb = allFeedback();
    return { ...strip(S.health), ...mock, deadline: deadline(fb),
      kpis: { ...S.health.kpis, backlog: fb.filter((f) => f.status !== 'Repaired').length + caisIssues().filter((c) => c.status !== 'Repaired').length } };
  },
  async checks(tradeDate) {
    const dates = Object.keys(S.checks).sort();
    return { ...strip(S.checks[tradeDate && S.checks[tradeDate] ? tradeDate : dates.at(-1)!]), ...mock };
  },
  async checkRecords(ruleId, tradeDate) {
    const r = S.checkRecords[`${ruleId}|${tradeDate}`];
    return r ? { ...strip(r), ...mock } : { ...mock, ruleId, tradeDate, total: 0, rows: [] };
  },
  async order(id) {
    const o = S.orders[id];
    return o ? { ...strip(o), ...mock, feedback: o.feedback.map(withRepairs) } : null;
  },
  async rejects() { const fb = allFeedback(); return { ...mock, clusters: clusters(fb), total: fb.length }; },
  async explain(id) {
    await wait(jitter(SAMPLE_DELAY_MS.explain));
    const e = S.explain[id];
    if (!e) throw new Error('No sample explanation for this cluster');
    return { ...strip(e), ...mock };
  },
  async repair(ids, action, assignee, note, aiAssisted) {
    if (action === 'Repaired' && !note.trim()) throw new Error('A repair note is required');
    let updated = 0;
    const current = new Map([...allFeedback(), ...caisIssues()].map((f) => [f.feedback_id, f]));
    for (const id of ids) {
      const f = current.get(id);
      if (!f || f.status === 'Repaired') continue;
      const prev = 'assignee' in f ? (f as Feedback).assignee : null;
      repairs.set(id, { status: action === 'Assign' ? 'Assigned' : 'Repaired', assignee: assignee || prev, repair_note: note || f.repair_note, updated_by: ACTOR, updated_ts: new Date().toISOString() });
      updated++;
    }
    log(action === 'Assign' ? `Assigned to ${assignee || 'unassigned'}` : 'Marked repaired', ids[0]?.startsWith('CF-') ? 'CAIS feedback' : 'CAT feedback', ids, note, aiAssisted);
    return { updated };
  },
  async cais() { return { ...mock, issues: caisIssues(), canonical: [...S.cais.canonical, ...canonical] }; },
  async match(recordId) {
    await wait(jitter(SAMPLE_DELAY_MS.match));
    const m = S.match[recordId];
    if (!m) throw new Error('No sample match for this record');
    return { ...strip(m), ...mock };
  },
  async approveCanonical(recordIds, c, note) {
    if (!note.trim()) throw new Error('An approval note is required');
    const id = `CAN-SAMPLE-${canonical.length + 1}`;
    canonical.push({ canonical_id: id, record_ids: recordIds.join(', '), name: c.name, dob: c.dob, address: c.address, customer_id: c.customer_id, approved_by: ACTOR, approved_ts: new Date().toISOString() });
    for (const i of caisIssues().filter((x) => x.error_code === 'CA-13' && recordIds.includes(x.record_id)))
      repairs.set(i.feedback_id, { status: 'Repaired', assignee: null, repair_note: `Canonical record ${id}: ${note}`, updated_by: ACTOR, updated_ts: new Date().toISOString() });
    log('Approved canonical customer record', 'CAIS customer', recordIds, `${id}: ${c.name}, ${c.dob}, ${c.address}. ${note}`, true);
    return { canonicalId: id };
  },
  async anomalies() { return { ...strip(S.anomalies), ...mock }; },
  async evidence() { return { ...mock, runs: [...runs, ...S.evidence.runs], approvals: [...approvals, ...S.evidence.approvals] }; },
  async runChecks(tradeDate) {
    await wait(jitter(SAMPLE_DELAY_MS.runChecks));
    const latest = S.evidence.runs.filter((r) => r.trade_date === tradeDate);
    const last = latest[0]?.run_id;
    const runId = `RUN-${tradeDate.replaceAll('-', '')}-SAMPLE${runs.length + 1}`;
    const ts = new Date().toISOString();
    runs.unshift(...latest.filter((r) => r.run_id === last).map((r) => ({ ...r, run_id: runId, run_ts: ts, run_by: ACTOR, trigger_type: 'Manual', query_id: 'sample' })));
    log('Ran pre-submission checks', 'Trade date', [tradeDate], `Run ${runId}`, false);
    return { runId };
  },
};
