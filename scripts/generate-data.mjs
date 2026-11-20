// Writes the synthetic CSVs and the rule library in data/ (seeded, so output is stable).
// Fictional broker-dealer: Northwind Securities. Schemas and error codes are illustrative, not the
// official CAT or CAIS specifications.
//
// Planted stories (documented in data/README.md):
//  1. Linkage break: from 2026-10-28 the ALGO-X system (Program Trading desk) drops the "PT-" prefix
//     on the routed order ID it sends to the firm's own ATS, so route events no longer link to the
//     ATS new-order event. The 2026-10-29 file gets a reject spike.
//  2. Clock drift: from 2026-10-26 the OMS-B system (Options desk) stamps route and execution events
//     about 1.4 seconds early on some orders, so they sort before the order's new-order event.
//  3. Completeness: on 2026-10-22 the MANUAL ticket system books 12 executions that never reach the
//     CAT feed.
//  4. CAIS: one customer (Elena Marchetti) holds three accounts whose records disagree on customer ID,
//     date of birth, and address.
//  5. Volume: 2026-10-16 (a synthetic index-rebalance day) carries about three times normal volume.
import { mkdirSync, writeFileSync } from 'node:fs';

let seed = 20261120;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const pad = (n, w = 5) => String(n).padStart(w, '0');
// Timestamps are Eastern time, written without an offset (TIMESTAMP_NTZ in Snowflake).
const ts = (d) => d.toISOString().replace('T', ' ').replace('Z', '');

function csv(name, header, rows) {
  const esc = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  writeFileSync(`data/${name}.csv`, [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n') + '\n');
  console.log(`${name}: ${rows.length}`);
}
mkdirSync('data', { recursive: true });

// Trading days. History (June to September) feeds the anomaly model as daily counts only;
// October 1 to 29 has full event detail.
const tradingDays = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 864e5)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
};
const HOLIDAYS = new Set(['2026-06-19', '2026-07-03', '2026-09-07']);
const HISTORY = tradingDays('2026-06-01', '2026-09-30').filter((d) => !HOLIDAYS.has(d));
const OCT = tradingDays('2026-10-01', '2026-10-29');
const nextDay = (d) => { const all = tradingDays(d, '2026-11-30'); return all[1]; };

const SYSTEMS = [
  { id: 'OMS-A', desks: ['EQ-CASH-1', 'EQ-CASH-2'], share: 0.5 },
  { id: 'OMS-B', desks: ['OPTIONS'], share: 0.22 },
  { id: 'ALGO-X', desks: ['PROGRAM-TRADING'], share: 0.24 },
  { id: 'MANUAL', desks: ['HIGH-TOUCH'], share: 0.04 },
];
const SYMBOLS = ['NWDX', 'QRLA', 'VEMB', 'TOLK', 'ZANF', 'BRIQ', 'HOLV', 'MERX', 'CYDA', 'PAXL', 'ULVO', 'KEST', 'DRAV', 'FENO', 'SOLQ', 'YARB'];
const DESTS = ['EXCH-A', 'EXCH-B', 'EXCH-C', 'NW-ATS'];
const baseVolume = (d) => (d === '2026-10-16' ? 3.1 : 1) * (0.9 + rnd() * 0.2);
const ORDERS_PER_DAY = 160;

// --- Customers and accounts (CAIS) ------------------------------------------------------------
const FIRST = ['Avery','Jordan','Priya','Mateo','Lena','Owen','Sofia','Kai','Nadia','Ellis','Rosa','Theo','Imani','Lucas','Maya','Ravi','Clara','Diego','Hana','Felix','Iris','Jonah','Zara','Milo','Anya','Caleb','Leah','Omar','Ruth','Simon','Talia','Viktor','Wren','Yusuf','Greta','Hugo'];
const LAST = ['Okafor','Lindqvist','Ramirez','Chen','Duarte','Abernathy','Kowalski','Nakamura','Osei','Brennan','Haddad','Moreau','Varga','Silva','Petrov','Quinlan','Adeyemi','Ferris','Tanaka','Holt','Ibarra','Juarez','Kaur','Lowell','Mbeki','Novak'];
const STREETS = ['Maple Ave','Harbor View Rd','Cedar Ln','Juniper St','Orchard Way','Lakeshore Dr','Granite Ct','Willow Bend','Summit Pl','Bayberry Rd'];
const CITIES = [['Fairhaven','MA','02719'],['Brookfield','WI','53045'],['Ridgefield','CT','06877'],['Clearwater','FL','33755'],['Springdale','AR','72762'],['Westlake','OH','44145'],['Marion','IA','52302'],['Greenville','SC','29601']];
const ACCT_TYPES = ['Individual', 'Joint', 'IRA', 'Trust', 'Entity'];
const BRANCHES = ['Boston', 'Chicago', 'Charlotte', 'Denver'];

const customers = [];
const records = []; // one customer record per account, as the books hold it
let acctN = 0;
for (let c = 1; c <= 360; c++) {
  const first = pick(FIRST), last = pick(LAST);
  const [city, state, postal] = pick(CITIES);
  const cust = {
    customer_id: `C-${pad(c, 4)}`, name: `${first} ${last}`,
    dob: `19${int(45, 99)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, tin_last4: pad(int(0, 9999), 4),
    address: `${int(10, 980)} ${pick(STREETS)}`, city, state, postal,
    large_trader: rnd() < 0.04,
  };
  customers.push(cust);
  const n = rnd() < 0.7 ? 1 : rnd() < 0.75 ? 2 : 3;
  for (let k = 0; k < n; k++) {
    acctN++;
    records.push({
      record_id: `R-${pad(acctN)}`, account_id: `A-${pad(acctN)}`, customer_id: cust.customer_id, name: cust.name, dob: cust.dob,
      tin_last4: cust.tin_last4, address: cust.address, city, state, postal_code: postal,
      large_trader_id: cust.large_trader ? (rnd() < 0.8 ? `LT${pad(int(1000000, 9999999), 7)}` : null) : null,
      large_trader_flag: cust.large_trader,
      account_type: pick(ACCT_TYPES), open_date: `20${pad(int(8, 25), 2)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, branch: pick(BRANCHES),
    });
  }
}
// Large-trader accounts must all carry the same ID; copy it so only the deliberately missing ones fail.
for (const c of customers.filter((x) => x.large_trader)) {
  const rs = records.filter((r) => r.customer_id === c.customer_id);
  const id = rs.find((r) => r.large_trader_id)?.large_trader_id ?? null;
  rs.forEach((r, i) => { r.large_trader_id = i === rs.length - 1 && rnd() < 0.5 ? null : id; });
}
// Story 4: Elena Marchetti, three accounts opened over the years, records that disagree.
const elena = [
  { customer_id: 'C-0412', name: 'Elena Marchetti', dob: '1971-03-14', address: '118 Harbor View Rd', open_date: '2011-05-02', account_type: 'Individual' },
  { customer_id: 'C-0412', name: 'Elena M. Marchetti', dob: '1971-03-14', address: '118 Harborview Road Apt 2', open_date: '2018-09-17', account_type: 'IRA' },
  { customer_id: 'C-0988', name: 'Elena Marchetti', dob: '1971-04-13', address: '118 Harbor View Rd Apt 2', open_date: '2024-02-08', account_type: 'Joint' },
];
for (const e of elena) {
  acctN++;
  records.push({ record_id: `R-${pad(acctN)}`, account_id: `A-${pad(acctN)}`, ...e, tin_last4: '4471', city: 'Fairhaven', state: 'MA', postal_code: '02719',
    large_trader_id: null, large_trader_flag: false, branch: 'Boston' });
}
// A second, smaller conflict: same person, one record with a postal code that lost its leading zero.
const ruthRecords = records.filter((r) => r.state === 'MA' || r.state === 'CT');
for (const r of ruthRecords.slice(0, 6)) r.postal_code = r.postal_code.replace(/^0/, '');

csv('customer_records', ['record_id', 'account_id', 'customer_id', 'name', 'dob', 'tin_last4', 'address', 'city', 'state', 'postal_code', 'large_trader_id', 'large_trader_flag'],
  records);
csv('accounts', ['account_id', 'account_type', 'open_date', 'branch'], records);

// CAIS submissions (one per record, 2026-10-29) and the regulator's feedback.
csv('cais_submissions', ['record_id', 'account_id', 'submitted_ts', 'file_id'], records.map((r) => ({ ...r, submitted_ts: '2026-10-29 21:15:00.000', file_id: 'CAIS-20261029-01' })));
const caisFeedback = [];
let fbN = 0;
const caisFb = (r, code, desc) => caisFeedback.push({ feedback_id: `CF-${pad(++fbN)}`, record_id: r.record_id, account_id: r.account_id, error_code: code, error_text: desc, received_ts: '2026-10-30 11:20:00.000' });
for (const r of records) {
  if (r.large_trader_flag && !r.large_trader_id) caisFb(r, 'CA-11', 'Large trader account reported without a large trader ID');
  if (!/^\d{5}$/.test(r.postal_code)) caisFb(r, 'CA-12', 'Postal code is not five digits');
}
for (const r of records.filter((x) => x.tin_last4 === '4471' && x.city === 'Fairhaven' && x.name.includes('Marchetti'))) caisFb(r, 'CA-13', 'Customer attributes differ across accounts for the same tax ID');
csv('cais_feedback', ['feedback_id', 'record_id', 'account_id', 'error_code', 'error_text', 'received_ts'], caisFeedback);

// --- Orders, events, executions (CAT) ---------------------------------------------------------
const accounts = records.map((r) => r.account_id);
const orders = [], events = [], execs = [], subs = [], feedback = [];
let oN = 0, eN = 0, xN = 0;
const ev = (o, type, t, extra = {}) => {
  const e = { event_id: `E-${pad(++eN, 7)}`, order_id: o.order_id, trade_date: o.trade_date, event_type: type, event_ts: ts(t), step_seq: extra.step_seq,
    source_system: o.source_system, desk: o.desk, firm_designated_id: o.account_id, symbol: o.symbol, side: o.side, quantity: extra.quantity ?? o.quantity,
    price: extra.price ?? null, destination: extra.destination ?? null, routed_order_id: extra.routed_order_id ?? null, exec_ref: extra.exec_ref ?? null };
  events.push(e);
  return e;
};

for (const d of OCT) {
  const n = Math.round(ORDERS_PER_DAY * baseVolume(d));
  for (let i = 0; i < n; i++) {
    const sys = (() => { const x = rnd(); let a = 0; for (const s of SYSTEMS) { a += s.share; if (x < a) return s; } return SYSTEMS[0]; })();
    const qty = int(1, 40) * 100;
    const o = { order_id: `O-${d.replaceAll('-', '').slice(2)}-${pad(++oN)}`, trade_date: d, source_system: sys.id, desk: pick(sys.desks), account_id: pick(accounts),
      symbol: pick(SYMBOLS), side: pick(['B', 'S', 'SS']), quantity: qty, order_type: pick(['LMT', 'LMT', 'MKT']),
      order_ts: new Date(`${d}T13:30:00Z`).getTime() + Math.floor(rnd() * 6.5 * 3600e3) };
    o.order_ts_str = ts(new Date(o.order_ts));
    orders.push(o);
    const t0 = o.order_ts;
    let seq = 1;
    // Story 2: OMS-B clock drift from 2026-10-26 on a third of its orders.
    const drift = sys.id === 'OMS-B' && d >= '2026-10-26' && rnd() < 0.33 ? -1400 : 0;
    const neu = ev(o, 'NEW', new Date(t0), { step_seq: seq++ });
    // An occasional invalid side code from any system (background noise for FLD-03).
    if (rnd() < 0.004) neu.side = 'X';
    const dest = sys.id === 'ALGO-X' ? (rnd() < 0.6 ? 'NW-ATS' : pick(DESTS)) : pick(DESTS);
    const routed = `${sys.id === 'ALGO-X' ? 'PT-' : 'R-'}${o.order_id.slice(2)}`;
    const tRoute = t0 + int(2, 40) + drift;
    ev(o, 'ROUTE', new Date(tRoute), { step_seq: seq++, destination: dest, routed_order_id: routed });
    if (dest === 'NW-ATS') {
      // Story 1: ALGO-X stops sending the PT- prefix to the ATS from 2026-10-28.
      const broken = sys.id === 'ALGO-X' && (d === '2026-10-29' || (d === '2026-10-28' && rnd() < 0.15));
      ev({ ...o, source_system: 'NW-ATS', desk: 'ATS' }, 'DEST_NEW', new Date(tRoute + int(1, 6)), { step_seq: seq++, destination: 'NW-ATS', routed_order_id: broken ? routed.replace('PT-', '') : routed });
    }
    const outcome = rnd();
    if (outcome < 0.12) { ev(o, 'CANCEL', new Date(tRoute + int(500, 90000)), { step_seq: seq++ }); continue; }
    if (outcome < 0.22) ev(o, 'MODIFY', new Date(tRoute + int(300, 30000)), { step_seq: seq++, quantity: qty + 100 });
    const fills = qty >= 200 && rnd() < 0.3 ? 2 : 1;
    let tFill = tRoute + int(50, 20000);
    for (let f = 0; f < fills; f++) {
      const px = Math.round((20 + rnd() * 280) * 100) / 100;
      const fq = fills === 1 ? qty : f === 0 ? Math.floor(qty / 200) * 100 || 100 : qty - (Math.floor(qty / 200) * 100 || 100);
      const x = { execution_id: `X-${pad(++xN, 6)}`, order_id: o.order_id, trade_date: d, exec_ts: ts(new Date(tFill)), symbol: o.symbol, side: o.side, quantity: fq, price: px,
        source_system: sys.id, desk: o.desk, account_id: o.account_id };
      execs.push(x);
      ev(o, 'EXECUTE', new Date(tFill + drift), { step_seq: seq++, quantity: fq, price: px, exec_ref: x.execution_id });
      tFill += int(100, 60000);
    }
  }
  // Story 3: 12 manual-ticket executions booked on 2026-10-22 that never reach the CAT feed.
  if (d === '2026-10-22') {
    for (let k = 0; k < 12; k++) {
      const o = { order_id: `O-${d.replaceAll('-', '').slice(2)}-${pad(++oN)}`, trade_date: d, source_system: 'MANUAL', desk: 'HIGH-TOUCH', account_id: pick(accounts),
        symbol: pick(SYMBOLS), side: pick(['B', 'S']), quantity: int(5, 50) * 100, order_type: 'LMT', order_ts: new Date(`${d}T19:${pad(10 + k * 3, 2)}:00Z`).getTime() };
      o.order_ts_str = ts(new Date(o.order_ts));
      orders.push(o);
      execs.push({ execution_id: `X-${pad(++xN, 6)}`, order_id: o.order_id, trade_date: d, exec_ts: ts(new Date(o.order_ts + 45000)), symbol: o.symbol, side: o.side,
        quantity: o.quantity, price: Math.round((20 + rnd() * 280) * 100) / 100, source_system: 'MANUAL', desk: 'HIGH-TOUCH', account_id: o.account_id });
    }
  }
}

// Submissions: one file per trade date, due 08:00 ET the next trading day. Two files are late.
const LATE = { '2026-10-13': '08:41:00', '2026-10-21': '08:17:00' };
const fileOf = (d) => `CAT-${d.replaceAll('-', '')}-01`;
const submittedAt = (d) => `${nextDay(d)} ${LATE[d] ?? `06:${pad(int(5, 50), 2)}:00`}.000`;
const subTs = Object.fromEntries(OCT.map((d) => [d, submittedAt(d)]));
for (const e of events) subs.push({ event_id: e.event_id, trade_date: e.trade_date, file_id: fileOf(e.trade_date), submitted_ts: subTs[e.trade_date] });

// Regulator feedback, received around 11:00 ET the day after submission.
let cfN = 0;
const fb = (e, code, text) => feedback.push({ feedback_id: `F-${pad(++cfN, 6)}`, event_id: e.event_id, order_id: e.order_id, trade_date: e.trade_date, file_id: fileOf(e.trade_date),
  error_code: code, error_text: text, received_ts: `${nextDay(e.trade_date)} 11:${pad(int(0, 50), 2)}:00.000` });
const byOrder = new Map();
for (const e of events) (byOrder.get(e.order_id) ?? byOrder.set(e.order_id, []).get(e.order_id)).push(e);
const destNew = new Set(events.filter((e) => e.event_type === 'DEST_NEW').map((e) => e.routed_order_id));
for (const [, es] of byOrder) {
  const neu = es.find((e) => e.event_type === 'NEW');
  for (const e of es) {
    if (e.event_type === 'ROUTE' && e.destination === 'NW-ATS' && !destNew.has(e.routed_order_id)) fb(e, 'LNK-01', 'Route to an industry member has no matching new-order event at the destination');
    if (e !== neu && e.event_type !== 'DEST_NEW' && e.event_ts < neu.event_ts) fb(e, 'SEQ-02', 'Event timestamp is earlier than the order origination event');
  }
  if (neu.side === 'X') fb(neu, 'FLD-03', 'Side code is not a valid value');
}
for (const d of Object.keys(LATE)) {
  const es = events.filter((e) => e.trade_date === d && e.event_type === 'NEW');
  for (const e of es.slice(0, 1)) fb(e, 'LTE-04', 'File received after the submission deadline');
}

csv('orders', ['order_id', 'trade_date', 'source_system', 'desk', 'account_id', 'symbol', 'side', 'quantity', 'order_type', 'order_ts'], orders.map((o) => ({ ...o, order_ts: o.order_ts_str })));
csv('order_events', ['event_id', 'order_id', 'trade_date', 'event_type', 'event_ts', 'step_seq', 'source_system', 'desk', 'firm_designated_id', 'symbol', 'side', 'quantity', 'price', 'destination', 'routed_order_id', 'exec_ref'], events);
csv('executions', ['execution_id', 'order_id', 'trade_date', 'exec_ts', 'symbol', 'side', 'quantity', 'price', 'source_system', 'desk', 'account_id'], execs);
csv('cat_submissions', ['event_id', 'trade_date', 'file_id', 'submitted_ts'], subs);
csv('cat_feedback', ['feedback_id', 'event_id', 'order_id', 'trade_date', 'file_id', 'error_code', 'error_text', 'received_ts'], feedback);

// Daily history (June to September) for the anomaly model: events and regulator rejects per system.
const hist = [];
// Events per system per day, matched to the October levels of the detailed feed.
const perSys = { 'OMS-A': [265, 0.2], 'OMS-B': [120, 0.3], 'ALGO-X': [129, 0.3], MANUAL: [24, 0.5] };
for (const d of HISTORY) for (const [s, [mean, spread]] of Object.entries(perSys)) {
  const evts = Math.round(mean * (1 - spread + rnd() * 2 * spread) * (new Date(`${d}T00:00:00Z`).getUTCDay() === 5 ? 1.06 : 1));
  hist.push({ trade_date: d, source_system: s, events: evts, rejects: Math.round(evts * 0.0025 * rnd() * 2) });
}
csv('daily_stats_history', ['trade_date', 'source_system', 'events', 'rejects'], hist);

// Rule library: what each pre-submission check tests. Loaded into CTRL.RULES by setup.sql.
const rules = [
  { rule_id: 'R-LNK-01', version: '1.2', name: 'Route links to destination new order', severity: 'High', error_code: 'LNK-01', method: 'Anti-join', description: 'Every route to the firm\'s own ATS must have a destination new-order event with the same routed order ID on the same trade date.' },
  { rule_id: 'R-SEQ-02', version: '1.0', name: 'Lifecycle timestamps in sequence', severity: 'High', error_code: 'SEQ-02', method: 'Window functions', description: 'Within an order, no event may carry a timestamp earlier than the order\'s new-order event, in the system\'s own step order.' },
  { rule_id: 'R-FLD-03', version: '2.1', name: 'Valid field values', severity: 'Medium', error_code: 'FLD-03', method: 'Domain check', description: 'Side is B, S, or SS; quantity is positive; symbol is present.' },
  { rule_id: 'R-CMP-05', version: '1.0', name: 'Books-to-CAT completeness', severity: 'High', error_code: null, method: 'Reconciliation', description: 'Every execution in the books has an EXECUTE event in the reporting feed with the same execution reference.' },
  { rule_id: 'R-DQ-06', version: '1.0', name: 'Firm designated ID present', severity: 'Medium', error_code: null, method: 'Data metric function (NULL_COUNT)', description: 'Firm designated ID is never null in the reporting feed.' },
  { rule_id: 'R-DQ-07', version: '1.0', name: 'Event ID unique', severity: 'Medium', error_code: null, method: 'Data metric function (DUPLICATE_COUNT)', description: 'Event IDs are unique within the reporting feed.' },
];
writeFileSync('data/rules.json', JSON.stringify(rules, null, 2) + '\n');
csv('rules', ['rule_id', 'version', 'name', 'severity', 'error_code', 'method', 'description'], rules);
console.log('feedback by code', Object.entries(feedback.reduce((a, f) => ((a[f.error_code] = (a[f.error_code] ?? 0) + 1), a), {})));
