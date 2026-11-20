'use client';

// Evidence: every check run with rule versions, counts, and query IDs, and every human decision
// (assignments, repairs, canonical-record approvals), with who made it and whether AI assisted.
import { Play } from 'lucide-react';
import { useState } from 'react';
import { dayLong, n, stamp } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Card, PoweredBy, SourceBadge, Thinking } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const local = (t: string) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function EvidencePage() {
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const { data: d, error } = useAsync(() => data.evidence(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Thinking label="Loading evidence" />;
  const latestDate = [...d.runs].sort((a, b) => b.trade_date.localeCompare(a.trade_date))[0]?.trade_date;
  const runIds = [...new Set(d.runs.map((r) => r.run_id))];

  const rerun = async () => {
    setBusy(true); setMsg(undefined);
    try { const r = await data.runChecks(latestDate); setMsg(`Run ${r.runId} recorded.`); setReload((x) => x + 1); }
    catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Evidence</h1>
          <p className="text-sm text-2 mt-1">{runIds.length} check runs and {d.approvals.length} recorded decisions</p>
        </div>
        <SourceBadge p={d} />
      </div>

      <Card title="Run the checks again" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
        <p className="text-sm text-2 mb-3">Refresh the validation pipeline and log a new run for trade date {latestDate ? dayLong(latestDate) : ''}, with the rule versions in force now.</p>
        {busy ? <Reasoning kind="runChecks" /> : <button className="btn btn-primary" onClick={rerun}><Play className="w-4 h-4" aria-hidden />Run checks for {latestDate}</button>}
        {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
      </Card>

      <Card title="Decision log">
        {d.approvals.length === 0 ? <p className="text-sm muted">No decisions yet. Assign or repair rejects in the workbench, or approve a canonical customer record, and they appear here.</p> : (
          <div className="overflow-x-auto relative">
            <table className="data-table">
              <thead><tr><th>When</th><th>Action</th><th>Object</th><th>Records</th><th>Note</th><th>AI assisted</th><th>By</th></tr></thead>
              <tbody>{d.approvals.map((a, i) => (
                <tr key={i}>
                  <td className="text-xs tabular whitespace-nowrap">{local(a.ts)}</td>
                  <td className="text-xs font-medium">{a.action}</td>
                  <td className="text-xs">{a.object_type}</td>
                  <td className="text-xs max-w-[14rem] truncate" title={a.object_ids}>{a.object_ids}</td>
                  <td className="text-xs max-w-[22rem]">{a.detail}</td>
                  <td>{a.ai_assisted ? <Tag tone="info">Yes</Tag> : <Tag>No</Tag>}</td>
                  <td className="text-xs">{a.actor}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Check run log" right={<PoweredBy>Data metric functions</PoweredBy>}>
        <div className="overflow-x-auto relative max-h-[30rem]">
          <table className="data-table">
            <thead><tr><th>Run</th><th>Trade date</th><th>Rule</th><th>Version</th><th>Checked</th><th>Failures</th><th>Query ID</th><th>Run at</th><th>Trigger</th></tr></thead>
            <tbody>{d.runs.slice(0, 120).map((r) => (
              <tr key={r.run_id + r.rule_id}>
                <td className="text-[11px] tabular">{r.run_id}</td>
                <td className="text-xs">{r.trade_date}</td>
                <td className="text-xs font-medium">{r.rule_id}</td>
                <td className="text-xs">v{r.rule_version}</td>
                <td className="text-xs tabular">{n(r.records_checked)}</td>
                <td className="tabular">{r.failures ? <Tag tone="bad">{r.failures}</Tag> : 0}</td>
                <td className="text-[11px] tabular muted">{r.query_id}</td>
                <td className="text-xs tabular whitespace-nowrap">{r.trigger_type === 'Backfill' ? stamp(r.run_ts.slice(0, 19)) : local(r.run_ts)}</td>
                <td className="text-xs">{r.trigger_type}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] muted mt-2">R-DQ-06 and R-DQ-07 are measured with the system data metric functions NULL_COUNT and DUPLICATE_COUNT. Showing the latest 120 rows.</p>
      </Card>
    </div>
  );
}
