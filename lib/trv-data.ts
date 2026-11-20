// One interface for every screen. lib/mock-data.ts serves the bundled sample; lib/live-data.ts
// queries Snowflake. The API route (and the hosted /try/ build) choose between them.
import type { CanonicalField, Cais, CheckRecords, Checks, Evidence, Explain, Health, Match, OrderTimeline, Rejects, Anomalies } from './types';

export type RepairAction = 'Assign' | 'Repaired';

export interface TrvData {
  health(): Promise<Health>;
  checks(tradeDate?: string): Promise<Checks>;
  checkRecords(ruleId: string, tradeDate: string): Promise<CheckRecords>;
  order(orderId: string): Promise<OrderTimeline | null>;
  rejects(): Promise<Rejects>;
  explain(clusterId: string): Promise<Explain>;
  repair(ids: string[], action: RepairAction, assignee: string, note: string, aiAssisted: boolean): Promise<{ updated: number }>;
  cais(): Promise<Cais>;
  match(recordId: string): Promise<Match>;
  approveCanonical(recordIds: string[], canonical: Record<CanonicalField, string>, note: string): Promise<{ canonicalId: string }>;
  anomalies(): Promise<Anomalies>;
  evidence(): Promise<Evidence>;
  runChecks(tradeDate: string): Promise<{ runId: string }>;
}
