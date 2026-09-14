/** Client for /api/api-keys/usage — the cross-key request log with CSV export. */

export type UsageLogRow = {
  id: string;
  keyId: string;
  keyName: string | null;
  keyStart: string | null;
  ownerEmail: string | null;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type UsageLogFilters = {
  keyId: string | null;
  status: 'all' | '2xx' | '4xx' | '5xx' | 'errors';
  method: string | null;
  search: string;
  days: '1' | '7' | '30' | '90';
};
export const DEFAULT_USAGE_FILTERS: UsageLogFilters = {
  keyId: null,
  status: 'all',
  method: null,
  search: '',
  days: '7',
};
export type UsageLogParams = UsageLogFilters & { page: number; limit: number };
export type UsageLogResponse = { rows: UsageLogRow[]; total: number; page: number; limit: number };

const BASE = '/api/api-keys/usage';

export function buildUsageQuery(p: Partial<UsageLogParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.keyId) q.set('keyId', p.keyId);
  if (p.status && p.status !== 'all') q.set('status', p.status);
  if (p.method) q.set('method', p.method);
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.days) q.set('days', p.days);
  return q;
}

export function hasActiveUsageFilters(f: UsageLogFilters): boolean {
  return (
    f.keyId !== null ||
    f.status !== 'all' ||
    f.method !== null ||
    f.search.trim() !== '' ||
    f.days !== DEFAULT_USAGE_FILTERS.days
  );
}

export async function fetchUsageLog(p: UsageLogParams): Promise<UsageLogResponse> {
  const res = await fetch(`${BASE}?${buildUsageQuery(p)}`);
  if (!res.ok) throw new Error(`Gagal memuat log pemakaian (${res.status})`);
  return res.json();
}

/** Same filters as the list; the browser downloads the CSV directly. */
export const usageExportUrl = (f: UsageLogFilters) => `${BASE}/export?${buildUsageQuery(f)}`;

export function statusClass(status: number): 'ok' | 'client' | 'server' {
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  return 'ok';
}
