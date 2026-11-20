// Formatting helpers shared by the screens. Times in the data are Eastern time without an offset.
export const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const dayLong = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** "14:03:21.418" from an ISO-like local timestamp. */
export const clock = (t: string | null | undefined) => (t ? t.slice(11, 23).replace(/\.000$/, '') : '—');
export const stamp = (t: string | null | undefined) => (t ? `${day(t)} ${t.slice(11, 16)} ET` : '—');
export const n = (x: number) => x.toLocaleString('en-US');
/** Hours between two local timestamps (no time zone math needed: both are Eastern). */
export const hoursBetween = (from: string, to: string) => (Date.parse(`${to.slice(0, 19)}Z`) - Date.parse(`${from.slice(0, 19)}Z`)) / 36e5;
export const countdown = (from: string, to: string) => {
  const h = hoursBetween(from, to);
  if (h <= 0) return 'Overdue';
  const d = Math.floor(h / 24);
  return d ? `${d}d ${Math.round(h - d * 24)}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
};
export const CODE_COLORS: Record<string, string> = { 'LNK-01': 'var(--chart-5)', 'SEQ-02': 'var(--chart-3)', 'FLD-03': 'var(--chart-4)', 'LTE-04': 'var(--chart-2)' };
export const CODE_NAMES: Record<string, string> = { 'LNK-01': 'Linkage break', 'SEQ-02': 'Out of sequence', 'FLD-03': 'Invalid field', 'LTE-04': 'Late', 'CA-11': 'Missing large trader ID', 'CA-12': 'Address format', 'CA-13': 'Inconsistent customer' };
export const TIP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } as const;
