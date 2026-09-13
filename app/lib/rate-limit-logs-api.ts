/** Typed fetch client for /api/analytics/rate-limit-logs used by /dev/rate-limit-logs. */
import type { Breakdown } from './visits-api';

export type RateLimitRow = {
  id: string;
  ip: string | null;
  path: string;
  method: string | null;
  userAgent: string | null;
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

export type RateLimitStats = {
  total: number;
  uniqueIps: number;
  last1h: number;
  last24h: number;
  last7d: number;
  authenticated: number;
  topIps: Breakdown[];
  topPaths: Breakdown[];
  topMethods: Breakdown[];
  topCountries: Breakdown[];
  devices: Breakdown[];
  config: { limit: number; windowMs: number; excludePrefixes: string[]; trackedClients: number };
};

export type RateLimitPeriod = '1' | '7' | '30' | 'all';

export type RateLimitFilters = {
  search: string;
  period: RateLimitPeriod;
  ip: string | null;
  path: string | null;
  method: string | null;
  country: string | null;
  device: string | null;
};

export const DEFAULT_RATE_LIMIT_FILTERS: RateLimitFilters = {
  search: '',
  period: 'all',
  ip: null,
  path: null,
  method: null,
  country: null,
  device: null,
};

export type RateLimitListParams = RateLimitFilters & {
  page: number;
  limit: number;
  sort: 'asc' | 'desc';
};
export type RateLimitListResponse = {
  rows: RateLimitRow[];
  total: number;
  page: number;
  limit: number;
};

const BASE = '/api/analytics/rate-limit-logs';

export function buildRateLimitQuery(p: Partial<RateLimitListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.sort) q.set('sort', p.sort);
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.period && p.period !== 'all') q.set('days', p.period);
  if (p.ip) q.set('ip', p.ip);
  if (p.path) q.set('path', p.path);
  if (p.method) q.set('method', p.method);
  if (p.country) q.set('country', p.country);
  if (p.device) q.set('device', p.device);
  return q;
}

export function hasActiveRateLimitFilters(f: RateLimitFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.period !== 'all' ||
    f.ip !== null ||
    f.path !== null ||
    f.method !== null ||
    f.country !== null ||
    f.device !== null
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

export const fetchRateLimits = (p: RateLimitListParams) =>
  request<RateLimitListResponse>(`${BASE}?${buildRateLimitQuery(p)}`);
export const fetchRateLimitStats = () => request<RateLimitStats>(`${BASE}/stats`);
export const deleteRateLimit = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const deleteRateLimits = (ids: string[]) =>
  request<{ deleted: number }>(BASE, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
export const exportRateLimitsUrl = (f: RateLimitFilters) =>
  `${BASE}/export?${buildRateLimitQuery(f)}`;

/** "60000" → "1 menit", "90000" → "1,5 menit", "5000" → "5 detik". */
export function formatWindow(ms: number): string {
  if (ms >= 60_000)
    return `${(ms / 60_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} menit`;
  return `${(ms / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} detik`;
}
