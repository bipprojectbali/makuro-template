/** Typed fetch client for the /api/analytics/visits endpoints used by /dev/visits. */

export type VisitRow = {
  id: string;
  ip: string | null;
  path: string;
  referer: string | null;
  userAgent: string | null;
  isBot: boolean;
  botKind: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | null;
  language: string | null;
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  createdAt: string;
};

export type Breakdown = { key: string | null; count: number };

export type VisitStats = {
  total: number;
  humans: number;
  bots: number;
  uniqueIps: number;
  last24h: number;
  last7d: number;
  loggedIn: number;
  topCountries: Breakdown[];
  topBrowsers: Breakdown[];
  topOs: Breakdown[];
  devices: Breakdown[];
  topPaths: Breakdown[];
  topReferers: Breakdown[];
};

export type VisitType = 'all' | 'human' | 'bot';
export type VisitPeriod = '1' | '7' | '30' | 'all';

export type VisitFilters = {
  search: string;
  type: VisitType;
  country: string | null;
  device: string | null;
  period: VisitPeriod;
};

export const DEFAULT_FILTERS: VisitFilters = {
  search: '',
  type: 'all',
  country: null,
  device: null,
  period: 'all',
};

export type VisitListParams = VisitFilters & { page: number; limit: number; sort: 'asc' | 'desc' };

export type VisitListResponse = { rows: VisitRow[]; total: number; page: number; limit: number };

const BASE = '/api/analytics/visits';

/** Query string for the list/export endpoints from UI filter state. */
export function buildVisitQuery(p: Partial<VisitListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.sort) q.set('sort', p.sort);
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.type && p.type !== 'all') q.set('type', p.type);
  if (p.country) q.set('country', p.country);
  if (p.device) q.set('device', p.device);
  if (p.period && p.period !== 'all') q.set('days', p.period);
  return q;
}

/** True when any filter differs from the defaults (drives the "reset" UI). */
export function hasActiveFilters(f: VisitFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.type !== 'all' ||
    f.country !== null ||
    f.device !== null ||
    f.period !== 'all'
  );
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Request ${init?.method ?? 'GET'} ${url} failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  return res.json() as Promise<T>;
}

export function fetchVisits(params: VisitListParams): Promise<VisitListResponse> {
  return request(`${BASE}?${buildVisitQuery(params)}`);
}

export function fetchVisitStats(): Promise<VisitStats> {
  return request(`${BASE}/stats`);
}

export function deleteVisit(id: string): Promise<{ ok: true }> {
  return request(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function deleteVisits(ids: string[]): Promise<{ deleted: number }> {
  return request(BASE, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

/** days=0 removes every row in visit, login and rate-limit logs. */
export function purgeLogs(days: number): Promise<{ purgedVisits: number }> {
  return request(`/api/analytics/purge?days=${days}`, { method: 'DELETE' });
}

export function exportVisitsUrl(filters: VisitFilters): string {
  return `${BASE}/export?${buildVisitQuery(filters)}`;
}
