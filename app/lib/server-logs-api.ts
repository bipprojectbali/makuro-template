/** Client for /api/logs (in-memory server log ring buffer). */

export type ServerLogRow = {
  seq?: number;
  level: number;
  levelName: string;
  time: number;
  msg: string;
  [key: string]: unknown;
};

export type ServerLogStats = {
  byLevel: Record<string, number>;
  size: number;
  capacity: number;
  oldest: number | null;
  newest: number | null;
  errorsLastHour: number;
  warningsLastHour: number;
};

export type LogLevelFilter = 'all' | 'info' | 'warn' | 'error';
export type ServerLogFilters = { level: LogLevelFilter; search: string };
export const DEFAULT_LOG_FILTERS: ServerLogFilters = { level: 'all', search: '' };

const BASE = '/api/logs';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat log server (${res.status})`);
  return res.json();
}

export type ServerLogPage = {
  rows: ServerLogRow[];
  total: number;
  page: number;
  limit: number;
  buffered: number;
};

/** One newest-first page; `before` (seq) pins pages beyond the first against new entries. */
export function fetchServerLogs(
  f: ServerLogFilters,
  p: { page: number; limit: number; before?: number | null },
): Promise<ServerLogPage> {
  const q = new URLSearchParams({ page: String(p.page), limit: String(p.limit) });
  if (p.before) q.set('before', String(p.before));
  if (f.level !== 'all') q.set('level', f.level);
  if (f.search.trim()) q.set('search', f.search.trim());
  return request(`${BASE}?${q}`);
}
export const fetchServerLogStats = () => request<ServerLogStats>(`${BASE}/stats`);

/** SSE URL for entries newer than `after` (seq) matching the filters. */
export function serverLogStreamUrl(f: ServerLogFilters, after: number): string {
  const q = new URLSearchParams({ after: String(after) });
  if (f.level !== 'all') q.set('level', f.level);
  if (f.search.trim()) q.set('search', f.search.trim());
  return `${BASE}/stream?${q}`;
}

/** Streamed rows (newest first) on top of the snapshot, de-duplicated by seq. */
export function mergeLogRows(streamed: ServerLogRow[], snapshot: ServerLogRow[]): ServerLogRow[] {
  const newest = snapshot[0]?.seq ?? 0;
  return [...streamed.filter((r) => (r.seq ?? 0) > newest), ...snapshot];
}

export const LEVEL_META: Record<string, { label: string; color: string }> = {
  trace: { label: 'trace', color: 'gray' },
  debug: { label: 'debug', color: 'gray' },
  info: { label: 'info', color: 'blue' },
  warn: { label: 'warn', color: 'yellow' },
  error: { label: 'error', color: 'red' },
  fatal: { label: 'fatal', color: 'red' },
};

const HIDDEN_KEYS = new Set(['level', 'time', 'msg', 'seq', 'levelName', 'env', 'pid', 'hostname']);

/** Extra structured fields of a log row (everything pino added beyond the basics). */
export function logExtras(row: ServerLogRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!HIDDEN_KEYS.has(k)) out[k] = v;
  return out;
}
