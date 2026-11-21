// Replaces Snowflake query IDs captured from a live run with synthetic ones, so the bundled
// sample never carries IDs from a real account. Each distinct ID maps to the same synthetic ID
// everywhere it appears (first seen = 1), so links between runs and evidence still line up.
const QUERY_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g;

export function syntheticQueryIds(json) {
  const seen = new Map();
  return json.replace(QUERY_ID, (id) => {
    if (!seen.has(id)) seen.set(id, `01sa0000-0000-4000-8000-${String(seen.size + 1).padStart(12, '0')}`);
    return seen.get(id);
  });
}
