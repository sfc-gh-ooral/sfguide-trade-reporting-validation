'use client';

// Evidence: every check run with rule versions, counts, and query IDs, and every human decision
// (assignments, repairs, canonical-record approvals), with who made it and whether AI assisted.
import { FileCheck2, Play } from 'lucide-react';
import { useState } from 'react';
import { dayLong, n, stamp } from '@/components/fmt';
import { Reasoning } from '@/components/Reasoning';
import { ErrorBox, Tag } from '@/components/Status';
import { Empty, PageHeader, PageSkeleton, Panel, PoweredBy, Segmented, SourceBadge } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { data } from '@/lib/client';

const local = (t: string) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function EvidencePage() {
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [ai, setAi] = useState<'all' | 'ai'>('all');
  const [rule, setRule] = useState<string>('all');
  const { data: d, error } = useAsync(() => data.evidence(), [reload], true);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <PageSkeleton label="Loading evidence" />;
  const latestDate = [...d.runs].sort((a, b) => b.trade_date.localeCompare(a.trade_date))[0]?.trade_date;
  const runIds = [...new Set(d.runs.map((r) => r.run_id))];
  const ruleIds = [...new Set(d.runs.map((r) => r.rule_id))].sort();

  const rerun = async () => {
    setBusy(true); setMsg(undefined);
    try { const r = await data.runChecks(latestDate); setMsg(`Run ${r.runId} recorded.`); setReload((x) => x + 1); }
    catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 stagger">
      <PageHeader eyebrow="Evidence · controls audit trail" title="What ran, what changed, who approved"
        sub={<>{runIds.length} check runs with rule versions and query IDs, and {d.approvals.length} recorded human decisions.</>} right={<SourceBadge p={d} />} />

      <Panel eyebrow="Re-run" title="Run the checks again" right={<PoweredBy>Dynamic Tables</PoweredBy>}>
        <p className="text-sm text-2 mb-3">Refresh the validation pipeline and log a new run for trade date {latestDate ? dayLong(latestDate) : ''}, with the rule versions in force now.</p>
        {busy ? <Reasoning kind="runChecks" title="Running the rule library" steps={['Refreshing the CHECK_FAILURES Dynamic Table', `Running 4 rule checks for ${latestDate}`, 'Measuring the feed with NULL_COUNT and DUPLICATE_COUNT', 'Writing the run log']} /> : <button className="btn btn-primary" onClick={rerun}><Play className="w-4 h-4" aria-hidden />Run checks for {latestDate}</button>}
        {msg && <p className="text-sm mt-2" role="status">{msg}</p>}
      </Panel>

      <Panel eyebrow="Human in the loop" title="Decision log" right={<Segmented label="Filter decisions" value={ai} onChange={setAi} options={[{ value: 'all', label: 'All' }, { value: 'ai', label: 'AI assisted' }]} />} pad={false}>
        {d.approvals.length === 0 ? <Empty icon={<FileCheck2 className="w-5 h-5" />} title="No decisions yet">Assign or repair rejects in the workbench, or approve a canonical customer record, and they appear here.</Empty> : (
          <div className="scroller">
            <table className="tbl">
              <thead><tr><th>When</th><th>Action</th><th>Object</th><th>Records</th><th>Note</th><th>AI assisted</th><th>By</th></tr></thead>
              <tbody>{d.approvals.filter((a) => ai === 'all' || a.ai_assisted).map((a, i) => (
                <tr key={i}>
                  <td className="text-xs mono whitespace-nowrap">{local(a.ts)}</td>
                  <td className="text-xs font-medium">{a.action}</td>
                  <td className="text-xs">{a.object_type}</td>
                  <td className="text-xs max-w-[14rem] truncate" title={a.object_ids}>{a.object_ids}</td>
                  <td className="text-xs max-w-[22rem]">{a.detail}</td>
                  <td>{a.ai_assisted ? <Tag tone="ai">Yes</Tag> : <Tag>No</Tag>}</td>
                  <td className="text-xs">{a.actor}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Control runs" title="Check run log" right={<><Segmented label="Filter rule" value={rule} onChange={setRule} options={[{ value: 'all', label: 'All rules' }, ...ruleIds.map((r) => ({ value: r, label: r }))]} /><PoweredBy>Data metric functions</PoweredBy></>} pad={false}>
        <div className="scroller max-h-[30rem]">
          <table className="tbl">
            <thead><tr><th>Run</th><th>Trade date</th><th>Rule</th><th>Version</th><th>Checked</th><th>Failures</th><th>Query ID</th><th>Run at</th><th>Trigger</th></tr></thead>
            <tbody>{d.runs.filter((r) => rule === 'all' || r.rule_id === rule).slice(0, 120).map((r) => (
              <tr key={r.run_id + r.rule_id}>
                <td className="mono text-[11px]">{r.run_id}</td>
                <td className="text-xs">{r.trade_date}</td>
                <td className="text-xs font-medium">{r.rule_id}</td>
                <td className="text-xs">v{r.rule_version}</td>
                <td className="text-xs mono">{n(r.records_checked)}</td>
                <td className="mono">{r.failures ? <Tag tone="bad">{r.failures}</Tag> : 0}</td>
                <td className="text-[11px] mono muted">{r.query_id}</td>
                <td className="text-xs mono whitespace-nowrap">{r.trigger_type === 'Backfill' ? stamp(r.run_ts.slice(0, 19)) : local(r.run_ts)}</td>
                <td className="text-xs">{r.trigger_type}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] muted p-4">R-DQ-06 and R-DQ-07 are measured with the system data metric functions NULL_COUNT and DUPLICATE_COUNT. Showing the latest 120 rows.</p>
      </Panel>
    </div>
  );
}
