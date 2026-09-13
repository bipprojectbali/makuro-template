/** Typed client + display helpers for /api/file-health (used by /dev/file-health). */

export type FileKind =
  | 'route'
  | 'service'
  | 'repository'
  | 'schema'
  | 'types'
  | 'utility'
  | 'config'
  | 'test'
  | 'component'
  | 'docs'
  | 'excluded'
  | 'other';
export type HealthStatus = 'ok' | 'warn' | 'over' | 'excluded';
export type ContextHazard = 'none' | 'caution' | 'danger';

export type FileHealthRow = {
  path: string;
  kind: FileKind;
  lines: number;
  chars: number;
  bytes: number;
  estTokens: number;
  limit: number | null;
  ratio: number | null;
  status: HealthStatus;
  hardLimitViolation: boolean;
  hazard: ContextHazard;
  advice: string;
};

export type FileHealthSummary = {
  scanned: number;
  ok: number;
  warn: number;
  over: number;
  excluded: number;
  hardViolations: number;
  caution: number;
  danger: number;
  totalTokens: number;
  byKind: Array<{ kind: FileKind; count: number; over: number; warn: number }>;
};

export type FileHealthResponse = {
  available: boolean;
  reason?: string;
  root: string;
  scannedAt: string;
  durationMs: number;
  summary: FileHealthSummary;
  rules: {
    kindLimits: Record<FileKind, number | null>;
    hardLimitLines: number;
    hardLimitChars: number;
    cautionTokens: number;
    dangerTokens: number;
  };
  rows: FileHealthRow[];
  total: number;
  page: number;
  limit: number;
};

export type FileHealthFilters = {
  search: string;
  status: HealthStatus | 'all';
  kind: FileKind | null;
  hazard: ContextHazard | null;
  sort: 'ratio' | 'lines' | 'tokens' | 'path';
};

export const DEFAULT_FILE_FILTERS: FileHealthFilters = {
  search: '',
  status: 'all',
  kind: null,
  hazard: null,
  sort: 'ratio',
};

/** Fetch every row at once — the repo has a few hundred files at most. */
const PAGE_LIMIT = 500;

export async function fetchFileHealth(
  f: FileHealthFilters,
  refresh = false,
): Promise<FileHealthResponse> {
  const q = new URLSearchParams({ limit: String(PAGE_LIMIT), sort: f.sort });
  if (f.search.trim()) q.set('search', f.search.trim());
  if (f.status !== 'all') q.set('status', f.status);
  if (f.kind) q.set('kind', f.kind);
  if (f.hazard) q.set('hazard', f.hazard);
  if (refresh) q.set('refresh', 'true');
  const res = await fetch(`/api/file-health?${q}`);
  if (!res.ok) throw new Error(`Gagal memuat file health (${res.status})`);
  return res.json();
}

export const KIND_LABELS: Record<FileKind, string> = {
  route: 'Route / handler',
  service: 'Service',
  repository: 'Repository / query',
  schema: 'Schema / validation',
  types: 'Types',
  utility: 'Utility',
  config: 'Config',
  test: 'Test',
  component: 'Page / component',
  docs: 'Docs',
  excluded: 'Dikecualikan',
  other: 'Lainnya',
};

export const STATUS_META: Record<HealthStatus, { label: string; color: string }> = {
  over: { label: 'Lewat batas', color: 'red' },
  warn: { label: 'Hampir batas', color: 'yellow' },
  ok: { label: 'Sehat', color: 'teal' },
  excluded: { label: 'Dikecualikan', color: 'gray' },
};

export const HAZARD_META: Record<ContextHazard, { label: string; color: string }> = {
  danger: { label: 'Bahaya', color: 'red' },
  caution: { label: 'Hati-hati', color: 'orange' },
  none: { label: 'Aman', color: 'teal' },
};

const nf = new Intl.NumberFormat('id-ID');
export const fmtNum = (n: number) => nf.format(n);

/** "12,4 rb" style compact token count for tight cells. */
export function fmtTokens(n: number): string {
  return n >= 1000
    ? `${(n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
    : String(n);
}
