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

export function fetchServerLogs(
  f: ServerLogFilters,
  limit = 300,
): Promise<{ rows: ServerLogRow[]; buffered: number }> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (f.level !== 'all') q.set('level', f.level);
  if (f.search.trim()) q.set('search', f.search.trim());
  return request(`${BASE}?${q}`);
}
export const fetchServerLogStats = () => request<ServerLogStats>(`${BASE}/stats`);

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
