// Captures the bundled sample (lib/sample/data.json) from the running app in Live mode, so Sample
// mode shows exactly what Live mode computed, including the AI outputs (labeled "Sample AI response")
// and their measured latency. Run after sql/setup.sql, with `npm run dev` using .env.local:
//   node scripts/capture-sample.mjs [http://localhost:3000]
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const call = async (op, ...args) => {
  const r = await fetch(`${BASE}/api/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
  const j = await r.json();
  if (!r.ok || j.source !== 'snowflake' && !j.notFound) throw new Error(`${op} ${JSON.stringify(args)}: ${j.error ?? 'not live'}`);
  return j;
};

const out = { health: await call('health'), checks: {}, checkRecords: {}, orders: {}, explain: {}, match: {} };
const first = await call('checks');
const orderIds = new Set();
for (const d of first.tradeDates) {
  const c = await call('checks', d);
  out.checks[d] = c;
  for (const r of c.rules.filter((x) => x.failures > 0 && ['R-LNK-01', 'R-SEQ-02', 'R-FLD-03', 'R-CMP-05'].includes(x.rule_id))) {
    const recs = await call('checkRecords', r.rule_id, d);
    out.checkRecords[`${r.rule_id}|${d}`] = recs;
    recs.rows.forEach((x) => orderIds.add(x.order_id));
  }
}
out.rejects = await call('rejects');
for (const c of out.rejects.clusters) {
  c.items.forEach((i) => orderIds.add(i.order_id));
  out.explain[c.cluster_id] = await call('explain', c.cluster_id);
  console.log('explain', c.cluster_id, out.explain[c.cluster_id].latencyMs, 'ms');
}
for (const id of orderIds) out.orders[id] = await call('order', id);
out.cais = await call('cais');
for (const i of out.cais.issues.filter((x) => x.error_code === 'CA-13')) out.match[i.record_id] = await call('match', i.record_id);
out.anomalies = await call('anomalies');
out.evidence = await call('evidence');

// Never ship the account's user name in the sample.
const json = JSON.stringify(out).replaceAll(env.SNOWFLAKE_USERNAME.toUpperCase(), 'REPORTING_ANALYST').replaceAll(env.SNOWFLAKE_USERNAME, 'reporting_analyst');
writeFileSync('lib/sample/data.json', json);
console.log('wrote lib/sample/data.json', (json.length / 1024).toFixed(0), 'KB;', orderIds.size, 'orders');
