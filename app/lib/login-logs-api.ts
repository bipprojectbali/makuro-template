/** Typed fetch client for /api/analytics/login-logs used by /dev/login-logs. */
import type { Breakdown } from './visits-api';

export type LoginRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  userRole: string | null;
  ip: string | null;
  userAgent: string | null;
  method: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | null;
  language: string | null;
  createdAt: string;
};

export type LoginStats = {
  total: number;
  uniqueUsers: number;
  uniqueIps: number;
  last24h: number;
  last7d: number;
  impersonations: number;
  topUsers: Array<{ userId: string; name: string | null; image: string | null; count: number }>;
  topCountries: Breakdown[];
  topMethods: Breakdown[];
  devices: Breakdown[];
  topBrowsers: Breakdown[];
  topOs: Breakdown[];
};

export type LoginPeriod = '1' | '7' | '30' | 'all';

export type LoginFilters = {
  search: string;
  period: LoginPeriod;
  country: string | null;
  device: string | null;
  method: string | null;
  userId: string | null;
};

export const DEFAULT_LOGIN_FILTERS: LoginFilters = {
  search: '',
  period: 'all',
  country: null,
  device: null,
  method: null,
  userId: null,
};

export type LoginListParams = LoginFilters & { page: number; limit: number; sort: 'asc' | 'desc' };
export type LoginListResponse = { rows: LoginRow[]; total: number; page: number; limit: number };

const BASE = '/api/analytics/login-logs';

export function buildLoginQuery(p: Partial<LoginListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.sort) q.set('sort', p.sort);
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.period && p.period !== 'all') q.set('days', p.period);
  if (p.country) q.set('country', p.country);
  if (p.device) q.set('device', p.device);
  if (p.method) q.set('method', p.method);
  if (p.userId) q.set('userId', p.userId);
  return q;
}

export function hasActiveLoginFilters(f: LoginFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.period !== 'all' ||
    f.country !== null ||
    f.device !== null ||
    f.method !== null ||
    f.userId !== null
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

export const fetchLogins = (p: LoginListParams) =>
  request<LoginListResponse>(`${BASE}?${buildLoginQuery(p)}`);
export const fetchLoginStats = () => request<LoginStats>(`${BASE}/stats`);
export const deleteLogin = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const deleteLogins = (ids: string[]) =>
  request<{ deleted: number }>(BASE, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
export const exportLoginsUrl = (f: LoginFilters) => `${BASE}/export?${buildLoginQuery(f)}`;

const METHOD_META: Record<string, { label: string; color: string }> = {
  email: { label: 'Email', color: 'blue' },
  google: { label: 'Google', color: 'red' },
  social: { label: 'Social', color: 'grape' },
  impersonation: { label: 'Impersonasi', color: 'orange' },
  switch: { label: 'Ganti akun', color: 'gray' },
};

/** Display label + badge color for a login method (unknown providers fall back to their id). */
export function methodMeta(method: string | null | undefined): { label: string; color: string } {
  if (!method) return { label: 'Tidak diketahui', color: 'gray' };
  return (
    METHOD_META[method] ?? {
      label: method.charAt(0).toUpperCase() + method.slice(1),
      color: 'indigo',
    }
  );
}
