// Rules shared by Sample and Live mode: reject clustering, deadlines, and the canonical-record proposal.
import type { CaisRecord, CanonicalField, Cluster, Feedback, MatchCandidate } from './types';
import { CANONICAL_FIELDS } from './types';

export const clusterId = (f: Pick<Feedback, 'error_code' | 'source_system' | 'desk'>) => `${f.error_code}|${f.source_system}|${f.desk}`;

/** Groups regulator feedback by root cause: error code, source system, and desk. Largest open clusters first. */
export function clusters(items: Feedback[]): Cluster[] {
  const m = new Map<string, Feedback[]>();
  for (const f of items) (m.get(clusterId(f)) ?? m.set(clusterId(f), []).get(clusterId(f))!).push(f);
  return [...m.entries()].map(([id, fs]) => ({
    cluster_id: id, error_code: fs[0].error_code, error_text: fs[0].error_text, desk: fs[0].desk, source_system: fs[0].source_system,
    trade_dates: [...new Set(fs.map((f) => f.trade_date))].sort(),
    count: fs.length, open: fs.filter((f) => f.status === 'Open').length, assigned: fs.filter((f) => f.status === 'Assigned').length,
    repaired: fs.filter((f) => f.status === 'Repaired').length, caught: fs.filter((f) => f.caught).length,
    items: fs.sort((a, b) => a.trade_date.localeCompare(b.trade_date) || a.feedback_id.localeCompare(b.feedback_id)),
  })).sort((a, b) => (b.open + b.assigned) - (a.open + a.assigned) || b.count - a.count);
}

/** The nth trading day (weekdays only) after an ISO date. */
export function tradingDaysAfter(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  let k = 0;
  while (k < n) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) k++; }
  return d.toISOString().slice(0, 10);
}

/** Repairs are due at 08:00 ET on the third trading day after the trade date (illustrative rule). */
export const repairDue = (tradeDate: string) => `${tradingDaysAfter(tradeDate, 3)}T08:00:00`;

export function deadline(items: { trade_date: string; status: string }[]) {
  const open = items.filter((f) => f.status !== 'Repaired');
  if (!open.length) return null;
  const oldest = open.map((f) => f.trade_date).sort()[0];
  return { tradeDate: oldest, due: repairDue(oldest), open: open.filter((f) => f.trade_date === oldest).length };
}

/** Proposes a canonical record: the most common value per field; ties go to the most recently opened account. */
export function propose(records: CaisRecord[]): Record<CanonicalField, string> {
  const byRecent = [...records].sort((a, b) => b.open_date.localeCompare(a.open_date));
  const out = {} as Record<CanonicalField, string>;
  for (const f of CANONICAL_FIELDS) {
    const counts = new Map<string, number>();
    for (const r of byRecent) counts.set(String(r[f]), (counts.get(String(r[f])) ?? 0) + 1);
    out[f] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return out;
}

export const conflicts = (records: CaisRecord[]) => CANONICAL_FIELDS.filter((f) => new Set(records.map((r) => String(r[f]))).size > 1);

export const matchText = (r: CaisRecord) => `${r.name}, born ${r.dob}, ${r.address}, ${r.city} ${r.state} ${r.postal_code}`;
export const MATCH_THRESHOLD = 0.85;
export const sortCandidates = (c: MatchCandidate[]) => c.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
