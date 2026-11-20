// Live mode: one pooled Snowflake connection under the least-privilege TRV_DEMO_ROLE. Server only.
// Every statement uses bind variables; nothing user-supplied is concatenated into SQL.
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

export const ROLE = process.env.SNOWFLAKE_ROLE ?? 'TRV_DEMO_ROLE';
let pool: Promise<snowflake.Connection> | undefined;

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME &&
    (process.env.SNOWFLAKE_PRIVATE_KEY_PATH || process.env.SNOWFLAKE_TOKEN || process.env.SNOWFLAKE_BROWSER_AUTH === 'true'));
}

function config(): snowflake.ConnectionOptions {
  const base: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    role: ROLE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'TRV_WH',
    database: process.env.SNOWFLAKE_DATABASE ?? 'TRADE_REPORTING_DEMO',
    schema: 'RPT',
    clientSessionKeepAlive: true,
  };
  // Key-pair auth is recommended. A programmatic access token or browser SSO also work for local testing.
  if (process.env.SNOWFLAKE_PRIVATE_KEY_PATH) return { ...base, authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH };
  if (process.env.SNOWFLAKE_TOKEN) return { ...base, authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: process.env.SNOWFLAKE_TOKEN };
  return { ...base, authenticator: 'EXTERNALBROWSER' };
}

async function connect(): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection(config());
  await new Promise<void>((resolve, reject) => {
    const cb = (err: snowflake.SnowflakeError | undefined) => (err ? reject(err) : resolve());
    if (process.env.SNOWFLAKE_BROWSER_AUTH === 'true' && !process.env.SNOWFLAKE_PRIVATE_KEY_PATH && !process.env.SNOWFLAKE_TOKEN) conn.connectAsync(cb);
    else conn.connect(cb);
  });
  await run(conn, 'USE SECONDARY ROLES NONE');
  return conn;
}

function run<T>(conn: snowflake.Connection, sqlText: string, binds?: snowflake.Binds): Promise<{ rows: T[]; queryId: string }> {
  return new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, s, rows) => (err ? reject(new Error(err.message)) : resolve({ rows: (rows ?? []) as T[], queryId: s.getQueryId() })) });
  });
}

export async function exec<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds): Promise<{ rows: T[]; queryId: string }> {
  if (!pool) { pool = connect(); pool.catch(() => { pool = undefined; }); }
  const conn = await pool;
  if (!conn.isUp()) { pool = undefined; return exec(sqlText, binds); }
  return run<T>(conn, sqlText, binds);
}
export const query = async <T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds) => (await exec<T>(sqlText, binds)).rows;
