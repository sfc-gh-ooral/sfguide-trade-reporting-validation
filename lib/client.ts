// Browser-side access to TrvData. The hosted /try/ build has no server, so it calls the mock
// implementation directly; otherwise every call goes to /api/data, which picks mock or live.
import type { TrvData } from './trv-data';
import { HOSTED_EXAMPLE } from './hosted';
import { mockData } from './mock-data';
import { preferSample } from './mode';

type Op = keyof TrvData;

async function call<T>(op: Op, args: unknown[]): Promise<T> {
  const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(preferSample() ? { 'x-trv-mode': 'sample' } : {}) }, body: JSON.stringify({ op, args }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return (json?.notFound ? null : json) as T;
}

const remote = new Proxy({} as TrvData, { get: (_t, op: Op) => (...args: unknown[]) => call(op, args) });

export const data: TrvData = HOSTED_EXAMPLE ? mockData : remote;
