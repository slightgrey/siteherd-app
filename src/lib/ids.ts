const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Check before querying a uuid column; Postgres throws on malformed input.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
