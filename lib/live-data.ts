// Live mode: reads and writes TRADE_REPORTING_DEMO with TRV_DEMO_ROLE. Checks come from the
// CHECK_FAILURES and BOOKS_RECON Dynamic Tables, anomalies from the SNOWFLAKE.ML.ANOMALY_DETECTION
// results, reject explanations from Cortex Search plus AI_COMPLETE, and customer matching from
// AI_SIMILARITY. Latency shown in the UI is measured here.
import { MATCH_THRESHOLD, clusters, deadline, sortCandidates } from './build';
import type { RepairAction, TrvData } from './trv-data';
import { ROLE, exec, query } from './snowflake';
import { CANONICAL_FIELDS, type AnomalySeries, type CaisIssue, type CaisRecord, type CheckRecord, type DayPoint, type Feedback } from './types';

const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
const SEARCH = 'TRADE_REPORTING_DEMO.RPT.SPEC_FAQ_SEARCH';
const RULE_IDS = new Set(['R-LNK-01', 'R-SEQ-02', 'R-FLD-03', 'R-CMP-05']);

type Row = Record<string, unknown>;
const lower = <T>(rows: Row[]): T[] => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])) as T);
async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> { const t0 = Date.now(); const r = await fn(); return [r, Date.now() - t0]; }
const live = (latencyMs: number) => ({ source: 'snowflake' as const, role: ROLE, latencyMs });
const TS = (c: string, a = c) => `TO_VARCHAR(${c}, 'YYYY-MM-DD"T"HH24:MI:SS.FF3') ${a}`;
const D = (c: string, a = c) => `TO_VARCHAR(${c}) ${a}`;
const parse = <T extends { detail: unknown }>(rows: T[]) => rows.map((r) => ({ ...r, detail: typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail }));

const FEEDBACK_SQL = `SELECT f.feedback_id, f.event_id, f.order_id, ${D('f.trade_date', 'trade_date')}, f.error_code, f.error_text, ${TS('f.received_ts', 'received_ts')},
    e.desk, e.source_system, r.status, r.assignee, r.repair_note, r.updated_by, ${TS('r.updated_ts', 'updated_ts')},
    EXISTS (SELECT 1 FROM RPT.CHECK_FAILURES c WHERE c.record_id = f.event_id) caught
  FROM SRC.CAT_FEEDBACK f JOIN SRC.ORDER_EVENTS e USING (event_id) JOIN RPT.REPAIRS r USING (feedback_id)`;
const feedback = async (where = '', binds: string[] = []) => lower<Feedback>(await query(`${FEEDBACK_SQL} ${where} ORDER BY f.trade_date, f.feedback_id`, binds));

const RECORD_COLS = `c.record_id, c.account_id, c.customer_id, c.name, ${D('c.dob', 'dob')}, c.tin_last4, c.address, c.city, c.state, c.postal_code, c.large_trader_id, a.account_type, ${D('a.open_date', 'open_date')}`;

async function log(action: string, objectType: string, ids: string[], detail: string, ai: boolean) {
  await query('INSERT INTO RPT.APPROVAL_LOG SELECT ?, ?, ?, ?, ?, CURRENT_USER(), CURRENT_TIMESTAMP()', [action, objectType, ids.join(', ').slice(0, 4000), detail.slice(0, 4000), ai]);
}

export const liveData: TrvData = {
  async health() {
    const [[cfg, days, codes, fb, cais], ms] = await timed(() => Promise.all([
      query<{ AS_OF: string }>(`SELECT ${TS('as_of', 'as_of')} FROM RPT.CONFIG`),
      query(`SELECT ${D('trade_date', 'trade_date')}, SUM(events) events, SUM(check_failures) check_failures, SUM(rejects) rejects FROM RPT.DAILY_STATS GROUP BY 1 ORDER BY 1`),
      query<{ TRADE_DATE: string; ERROR_CODE: string; N: number }>(`SELECT ${D('trade_date', 'trade_date')}, error_code, COUNT(*) n FROM SRC.CAT_FEEDBACK GROUP BY 1, 2`),
      feedback(),
      query<{ STATUS: string }>(`SELECT r.status FROM RPT.REPAIRS r WHERE r.regime = 'CAIS'`),
    ]));
    const trend = lower<DayPoint>(days).map((d) => ({ ...d, events: Number(d.events), check_failures: Number(d.check_failures), rejects: Number(d.rejects),
      by_code: Object.fromEntries(codes.filter((c) => c.TRADE_DATE === d.trade_date).map((c) => [c.ERROR_CODE, Number(c.N)])) }));
    const last = trend.at(-1)!;
    const lastFb = fb.filter((f) => f.trade_date === last.trade_date);
    return {
      ...live(ms), asOf: cfg[0].AS_OF, latestTradeDate: last.trade_date, trend, deadline: deadline(fb),
      kpis: { records: last.events, checkFailures: last.check_failures, rejects: last.rejects,
        backlog: fb.filter((f) => f.status !== 'Repaired').length + cais.filter((c) => c.STATUS !== 'Repaired').length,
        caught: lastFb.filter((f) => f.caught).length, caughtOf: lastFb.length },
    };
  },

  async checks(tradeDate) {
    const [[dates, rules, recon], ms] = await timed(async () => {
      const dates = (await query<{ D: string }>(`SELECT DISTINCT ${D('trade_date', 'd')} FROM RPT.RUN_LOG ORDER BY 1`)).map((r) => r.D);
      const td = tradeDate && dates.includes(tradeDate) ? tradeDate : dates.at(-1)!;
      return [dates, await query(`SELECT r.rule_id, r.name, r.version, r.severity, r.method, r.description, r.error_code, l.records_checked, l.failures, l.run_id, ${TS('l.run_ts', 'run_ts')}
          FROM RPT.RULES r JOIN RPT.RUN_LOG l ON l.rule_id = r.rule_id AND l.trade_date = ?
          QUALIFY ROW_NUMBER() OVER (PARTITION BY r.rule_id ORDER BY l.run_ts DESC) = 1 ORDER BY r.rule_id`, [td]),
        await query(`SELECT source_system, books_executions, reported_executions, missing_from_cat FROM RPT.BOOKS_RECON WHERE trade_date = ? ORDER BY source_system`, [td])] as const;
    });
    const td = tradeDate && dates.includes(tradeDate) ? tradeDate : dates.at(-1)!;
    const num = <T extends Row>(r: T) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v) && /checked|failures|executions|missing/.test(k)) ? Number(v) : v]));
    return { ...live(ms), tradeDates: dates, tradeDate: td, rules: lower(rules.map(num)), recon: lower(recon.map(num)) };
  },

  async checkRecords(ruleId, tradeDate) {
    if (!RULE_IDS.has(ruleId)) throw new Error('Unknown rule');
    const [[rows, n], ms] = await timed(() => Promise.all([
      query(`SELECT rule_id, ${D('trade_date', 'trade_date')}, record_id, order_id, desk, source_system, detail::VARCHAR detail FROM RPT.CHECK_FAILURES
        WHERE rule_id = ? AND trade_date = ? ORDER BY record_id LIMIT 50`, [ruleId, tradeDate]),
      query<{ N: number }>('SELECT COUNT(*) n FROM RPT.CHECK_FAILURES WHERE rule_id = ? AND trade_date = ?', [ruleId, tradeDate]),
    ]));
    return { ...live(ms), ruleId, tradeDate, total: Number(n[0].N), rows: parse(lower<CheckRecord>(rows)) };
  },

  async order(orderId) {
    const [[o, evs, dest, xs, fails, fb], ms] = await timed(async () => {
      const ev = `SELECT e.event_id, e.event_type, ${TS('e.event_ts', 'event_ts')}, e.step_seq, e.source_system, e.desk, e.side, e.quantity, e.price, e.destination,
        e.routed_order_id, e.exec_ref, ${TS('s.submitted_ts', 'submitted_ts')} FROM SRC.ORDER_EVENTS e LEFT JOIN SRC.CAT_SUBMISSIONS s USING (event_id)`;
      return Promise.all([
        query(`SELECT order_id, ${D('trade_date', 'trade_date')}, source_system, desk, account_id, symbol, side, quantity, order_type, ${TS('order_ts', 'order_ts')} FROM SRC.ORDERS WHERE order_id = ?`, [orderId]),
        query(`${ev} WHERE e.order_id = ? AND e.event_type <> 'DEST_NEW' ORDER BY e.step_seq`, [orderId]),
        // The firm's ATS reports its own new-order event for routes it receives.
        query(`${ev} WHERE e.event_type = 'DEST_NEW' AND e.order_id = ? ORDER BY e.step_seq`, [orderId]),
        query(`SELECT execution_id, ${TS('exec_ts', 'exec_ts')}, quantity, price, source_system FROM SRC.EXECUTIONS WHERE order_id = ? ORDER BY exec_ts`, [orderId]),
        query(`SELECT rule_id, ${D('trade_date', 'trade_date')}, record_id, order_id, desk, source_system, detail::VARCHAR detail FROM RPT.CHECK_FAILURES WHERE order_id = ?`, [orderId]),
        feedback('WHERE f.order_id = ?', [orderId]),
      ]);
    });
    if (!o.length) return null;
    return { ...live(ms), order: lower(o)[0] as never, events: lower(evs), destEvents: lower(dest), executions: lower(xs), failures: parse(lower<CheckRecord>(fails)), feedback: fb };
  },

  async rejects() {
    const [fb, ms] = await timed(() => feedback());
    return { ...live(ms), clusters: clusters(fb), total: fb.length };
  },

  async explain(id) {
    const [code, system, desk] = id.split('|');
    const [out, ms] = await timed(async () => {
      const items = await feedback('WHERE f.error_code = ? AND e.source_system = ? AND e.desk = ?', [code, system, desk]);
      if (!items.length) throw new Error('Cluster not found');
      const ex = await query<{ D: string }>(`SELECT f.event_id || ': ' || COALESCE(c.detail::VARCHAR, OBJECT_CONSTRUCT('event_type', e.event_type, 'event_ts', e.event_ts, 'routed_order_id', e.routed_order_id, 'side', e.side)::VARCHAR) d
        FROM SRC.CAT_FEEDBACK f JOIN SRC.ORDER_EVENTS e USING (event_id) LEFT JOIN RPT.CHECK_FAILURES c ON c.record_id = f.event_id
        WHERE f.error_code = ? AND e.source_system = ? AND e.desk = ? ORDER BY f.feedback_id LIMIT 3`, [code, system, desk]);
      const search = await query<{ R: string }>('SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(?, ?) r', [SEARCH,
        JSON.stringify({ query: `${code} ${items[0].error_text}`, columns: ['title', 'body', 'error_code'], limit: 3 })]);
      const hits: { title: string; body: string; error_code: string | null }[] = JSON.parse(search[0].R).results ?? [];
      const dates = [...new Set(items.map((i) => i.trade_date))].sort();
      const prompt = `You help a broker-dealer regulatory reporting analyst work regulator feedback. Using only the facts and FAQ excerpts below, write two short paragraphs in plain English (under 130 words in total): what this error code means, and the most likely root cause given the pattern (one system and desk, the dates). Do not invent facts. Then write a line starting exactly "Suggested repair:" followed by two or three numbered steps on one line each.

Error code: ${code} (${items[0].error_text})
Cluster: ${items.length} rejects, source system ${system}, desk ${desk}, trade dates ${dates.join(', ')}. Rejects in other systems with this code: see counts only for this cluster.
Example records: ${ex.map((e) => e.D).join(' | ')}
FAQ excerpts:
${hits.map((h) => `- ${h.title}: ${h.body}`).join('\n')}`;
      const r = await query<{ R: string }>('SELECT AI_COMPLETE(?, ?) r', [MODEL, prompt]);
      return { text: String(r[0].R ?? '').trim(), hits };
    });
    const [body, repair = ''] = out.text.split(/\n?\s*\**Suggested repair:\**/i);
    return { ...live(ms), model: MODEL, text: body.trim(), repair: repair.trim(), sources: out.hits.map((h) => ({ title: h.title, error_code: h.error_code || null })) };
  },

  async repair(ids, action: RepairAction, assignee, note, aiAssisted) {
    if (!['Assign', 'Repaired'].includes(action)) throw new Error('Unknown action');
    if (!ids.length || ids.length > 500) throw new Error('Select between 1 and 500 items');
    if (action === 'Repaired' && !note.trim()) throw new Error('A repair note is required');
    const marks = ids.map(() => '?').join(',');
    const status = action === 'Assign' ? 'Assigned' : 'Repaired';
    const { rows } = await exec<{ 'number of rows updated': number }>(`UPDATE RPT.REPAIRS SET status = ?, assignee = COALESCE(NULLIF(?, ''), assignee),
      repair_note = COALESCE(NULLIF(?, ''), repair_note), updated_by = CURRENT_USER(), updated_ts = CURRENT_TIMESTAMP()
      WHERE status <> 'Repaired' AND feedback_id IN (${marks})`, [status, assignee, note, ...ids]);
    const n = Number(rows[0]?.['number of rows updated'] ?? 0);
    await log(action === 'Assign' ? `Assigned to ${assignee || 'unassigned'}` : 'Marked repaired', ids[0].startsWith('CF-') ? 'CAIS feedback' : 'CAT feedback', ids, note, aiAssisted);
    return { updated: n };
  },

  async cais() {
    const [[issues, canon], ms] = await timed(() => Promise.all([
      query(`SELECT f.feedback_id, f.record_id, f.error_code, f.error_text, r.status, r.repair_note, r.updated_by, ${RECORD_COLS}
        FROM SRC.CAIS_FEEDBACK f JOIN RPT.REPAIRS r USING (feedback_id) JOIN SRC.CUSTOMER_RECORDS c ON c.record_id = f.record_id JOIN SRC.ACCOUNTS a ON a.account_id = c.account_id
        ORDER BY IFF(f.error_code = 'CA-13', 0, 1), f.feedback_id`),
      query(`SELECT canonical_id, record_ids, name, ${D('dob', 'dob')}, address, customer_id, approved_by, ${TS('approved_ts', 'approved_ts')} FROM RPT.CANONICAL_CUSTOMERS ORDER BY approved_ts`),
    ]));
    const rec = (r: Row): CaisRecord => Object.fromEntries(['record_id', 'account_id', 'customer_id', 'name', 'dob', 'tin_last4', 'address', 'city', 'state', 'postal_code', 'large_trader_id', 'account_type', 'open_date'].map((k) => [k, r[k]])) as never;
    return { ...live(ms), issues: lower<Row>(issues).map((r) => ({ feedback_id: r.feedback_id, record_id: r.record_id, error_code: r.error_code, error_text: r.error_text, status: r.status, repair_note: r.repair_note, updated_by: r.updated_by, record: rec(r) }) as CaisIssue), canonical: lower(canon) };
  },

  async match(recordId) {
    // Blocking: compare only records that share the tax ID's last four digits; AI_SIMILARITY scores the rest.
    const [rows, ms] = await timed(() => query(`WITH anchor AS (SELECT * FROM SRC.CUSTOMER_RECORDS WHERE record_id = ?)
      SELECT ${RECORD_COLS}, IFF(c.record_id = anchor.record_id, NULL, ROUND(AI_SIMILARITY(
          anchor.name || ', born ' || anchor.dob || ', ' || anchor.address || ', ' || anchor.city || ' ' || anchor.state || ' ' || anchor.postal_code,
          c.name || ', born ' || c.dob || ', ' || c.address || ', ' || c.city || ' ' || c.state || ' ' || c.postal_code), 3)) score
      FROM SRC.CUSTOMER_RECORDS c JOIN SRC.ACCOUNTS a ON a.account_id = c.account_id, anchor
      WHERE c.tin_last4 = anchor.tin_last4`, [recordId]));
    const all = lower<Row>(rows).map((r) => ({ record: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'score')) as unknown as CaisRecord, score: r.score === null ? null : Number(r.score) }));
    const anchor = all.find((c) => c.record.record_id === recordId);
    if (!anchor) throw new Error('Record not found');
    return { ...live(ms), anchor: anchor.record, candidates: sortCandidates(all.filter((c) => c !== anchor)), threshold: MATCH_THRESHOLD };
  },

  async approveCanonical(recordIds, canonical, note) {
    if (!recordIds.length || recordIds.length > 20) throw new Error('Select between 1 and 20 records');
    if (!note.trim()) throw new Error('An approval note is required');
    for (const f of CANONICAL_FIELDS) if (typeof canonical[f] !== 'string') throw new Error(`Missing ${f}`);
    const id = `CAN-${Date.now().toString(36).toUpperCase()}`;
    await query(`INSERT INTO RPT.CANONICAL_CUSTOMERS SELECT ?, ?, ?, TRY_TO_DATE(?), ?, ?, ?, ?, ?, CURRENT_USER(), CURRENT_TIMESTAMP()`,
      [id, recordIds.join(', '), canonical.name, canonical.dob, canonical.address, canonical.city, canonical.state, canonical.postal_code, canonical.customer_id]);
    const marks = recordIds.map(() => '?').join(',');
    await query(`UPDATE RPT.REPAIRS SET status = 'Repaired', repair_note = ?, updated_by = CURRENT_USER(), updated_ts = CURRENT_TIMESTAMP()
      WHERE feedback_id IN (SELECT feedback_id FROM SRC.CAIS_FEEDBACK WHERE error_code = 'CA-13' AND record_id IN (${marks}))`, [`Canonical record ${id}: ${note}`, ...recordIds]);
    await log('Approved canonical customer record', 'CAIS customer', recordIds, `${id}: ${canonical.name}, ${canonical.dob}, ${canonical.address}. ${note}`, true);
    return { canonicalId: id };
  },

  async anomalies() {
    const [rows, ms] = await timed(() => query(`SELECT REPLACE(series, '"', '') series, ${D('ts::DATE', 'd')}, y, forecast, lower_bound, upper_bound, is_anomaly FROM RPT.ANOMALY_RESULTS ORDER BY series, ts`));
    const m = new Map<string, AnomalySeries>();
    for (const r of lower<Row>(rows)) {
      const s = String(r.series);
      if (!m.has(s)) { const [system, metric] = s.split(' · '); m.set(s, { series: s, system, metric: metric as 'events' | 'rejects', points: [] }); }
      m.get(s)!.points.push({ date: String(r.d), y: Number(r.y), forecast: Number(r.forecast), lower: Number(r.lower_bound), upper: Number(r.upper_bound), is_anomaly: !!r.is_anomaly });
    }
    return { ...live(ms), series: [...m.values()] };
  },

  async evidence() {
    const [[runs, approvals], ms] = await timed(() => Promise.all([
      query(`SELECT run_id, ${D('trade_date', 'trade_date')}, rule_id, rule_version, records_checked, failures, query_id, ${TS('run_ts', 'run_ts')}, run_by, trigger_type
        FROM RPT.RUN_LOG ORDER BY run_ts DESC, rule_id LIMIT 300`),
      query(`SELECT action, object_type, object_ids, detail, ai_assisted, actor, ${TS('ts', 'ts')} FROM RPT.APPROVAL_LOG ORDER BY ts DESC LIMIT 200`),
    ]));
    return { ...live(ms), runs: lower<Row>(runs).map((r) => ({ ...r, records_checked: Number(r.records_checked), failures: Number(r.failures) })) as never, approvals: lower(approvals) };
  },

  async runChecks(tradeDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) throw new Error('Bad trade date');
    await query('ALTER DYNAMIC TABLE RPT.CHECK_FAILURES REFRESH');
    const r = await query<{ RUN_CHECKS: string }>(`CALL RPT.RUN_CHECKS(?::DATE, 'Manual')`, [tradeDate]);
    const out = typeof r[0].RUN_CHECKS === 'string' ? JSON.parse(r[0].RUN_CHECKS) : r[0].RUN_CHECKS;
    await log('Ran pre-submission checks', 'Trade date', [tradeDate], `Run ${out.run_id}`, false);
    return { runId: out.run_id };
  },
};
