// Shapes shared by Sample mode (bundled JSON) and Live mode (Snowflake). Column names match sql/setup.sql.
export interface Provenance { source: 'mock' | 'snowflake'; role?: string; latencyMs?: number }

export interface DayPoint { trade_date: string; events: number; check_failures: number; rejects: number; by_code: Record<string, number> }
export interface Health extends Provenance {
  asOf: string; latestTradeDate: string;
  kpis: { records: number; checkFailures: number; rejects: number; backlog: number; caught: number; caughtOf: number };
  deadline: { tradeDate: string; due: string; open: number } | null;
  trend: DayPoint[];
}

export interface RuleResult {
  rule_id: string; name: string; version: string; severity: string; method: string; description: string; error_code: string | null;
  records_checked: number; failures: number; run_id: string; run_ts: string;
}
export interface ReconRow { source_system: string; books_executions: number; reported_executions: number; missing_from_cat: number }
export interface Checks extends Provenance { tradeDates: string[]; tradeDate: string; rules: RuleResult[]; recon: ReconRow[] }

export interface CheckRecord { rule_id: string; trade_date: string; record_id: string; order_id: string; desk: string; source_system: string; detail: Record<string, unknown> }
export interface CheckRecords extends Provenance { ruleId: string; tradeDate: string; total: number; rows: CheckRecord[] }

export interface OrderEvent {
  event_id: string; event_type: string; event_ts: string; step_seq: number; source_system: string; desk: string; side: string; quantity: number;
  price: number | null; destination: string | null; routed_order_id: string | null; exec_ref: string | null; submitted_ts: string | null;
}
export interface Execution { execution_id: string; exec_ts: string; quantity: number; price: number; source_system: string }
export interface OrderRow { order_id: string; trade_date: string; source_system: string; desk: string; account_id: string; symbol: string; side: string; quantity: number; order_type: string; order_ts: string }
export interface OrderTimeline extends Provenance { order: OrderRow; events: OrderEvent[]; destEvents: OrderEvent[]; executions: Execution[]; failures: CheckRecord[]; feedback: Feedback[] }

export type RepairStatus = 'Open' | 'Assigned' | 'Repaired';
export interface Feedback {
  feedback_id: string; event_id: string; order_id: string; trade_date: string; error_code: string; error_text: string; received_ts: string;
  desk: string; source_system: string; status: RepairStatus; assignee: string | null; repair_note: string | null; updated_by: string | null; updated_ts: string | null;
  caught: boolean;
}
export interface Cluster {
  cluster_id: string; error_code: string; error_text: string; desk: string; source_system: string; trade_dates: string[];
  count: number; open: number; assigned: number; repaired: number; caught: number; items: Feedback[];
}
export interface Rejects extends Provenance { clusters: Cluster[]; total: number }
export interface Explain extends Provenance { text: string; repair: string; sources: { title: string; error_code: string | null }[]; model?: string }

export interface CaisRecord {
  record_id: string; account_id: string; customer_id: string; name: string; dob: string; tin_last4: string; address: string; city: string;
  state: string; postal_code: string; large_trader_id: string | null; account_type: string; open_date: string;
}
export interface CaisIssue { feedback_id: string; record_id: string; error_code: string; error_text: string; status: RepairStatus; repair_note: string | null; updated_by: string | null; record: CaisRecord }
export interface Canonical { canonical_id: string; record_ids: string; name: string; dob: string; address: string; customer_id: string; approved_by: string; approved_ts: string }
export interface Cais extends Provenance { issues: CaisIssue[]; canonical: Canonical[] }
export interface MatchCandidate { record: CaisRecord; score: number | null }
export interface Match extends Provenance { anchor: CaisRecord; candidates: MatchCandidate[]; threshold: number }

export interface AnomalyPoint { date: string; y: number; forecast: number; lower: number; upper: number; is_anomaly: boolean }
export interface AnomalySeries { series: string; system: string; metric: 'events' | 'rejects'; points: AnomalyPoint[] }
export interface Anomalies extends Provenance { series: AnomalySeries[] }

export interface RunLogRow { run_id: string; trade_date: string; rule_id: string; rule_version: string; records_checked: number; failures: number; query_id: string; run_ts: string; run_by: string; trigger_type: string }
export interface Approval { action: string; object_type: string; object_ids: string; detail: string; ai_assisted: boolean; actor: string; ts: string }
export interface Evidence extends Provenance { runs: RunLogRow[]; approvals: Approval[] }

export const CANONICAL_FIELDS = ['customer_id', 'name', 'dob', 'address', 'city', 'state', 'postal_code'] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];
