/** Client for /api/sessions (cross-user session management). */

export type SessionRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  userRole: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  impersonatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type SessionStats = {
  active: number;
  expired: number;
  users: number;
  impersonated: number;
  expiringSoon: number;
  activeLastHour: number;
  soonHours: number;
};

export type SessionFilters = {
  search: string;
  status: 'active' | 'expired' | 'all';
  userId: string | null;
  impersonated: boolean;
};
export const DEFAULT_SESSION_FILTERS: SessionFilters = {
  search: '',
  status: 'active',
  userId: null,
  impersonated: false,
};
export type SessionListParams = SessionFilters & { page: number; limit: number };
export type SessionListResponse = {
  rows: SessionRow[];
  total: number;
  page: number;
  limit: number;
};

const BASE = '/api/sessions';

export function buildSessionQuery(p: Partial<SessionListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.status && p.status !== 'active') q.set('status', p.status);
  if (p.userId) q.set('userId', p.userId);
  if (p.impersonated) q.set('impersonated', 'true');
  return q;
}

export function hasActiveSessionFilters(f: SessionFilters): boolean {
  return f.search.trim() !== '' || f.status !== 'active' || f.userId !== null || f.impersonated;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} gagal (${res.status})`);
  return res.json();
}
export const fetchSessions = (p: SessionListParams) =>
  request<SessionListResponse>(`${BASE}?${buildSessionQuery(p)}`);
export const fetchSessionStats = () => request<SessionStats>(`${BASE}/stats`);
export const revokeSession = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const revokeUserSessions = (userId: string, keep?: string) =>
  request<{ revoked: number }>(
    `${BASE}/user/${encodeURIComponent(userId)}${keep ? `?keep=${encodeURIComponent(keep)}` : ''}`,
    { method: 'DELETE' },
  );

export function isExpired(s: Pick<SessionRow, 'expiresAt'>, now = Date.now()): boolean {
  return new Date(s.expiresAt).getTime() <= now;
}
