/** Typed client for /api/admin/users used by /dev/users. */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  activeSessions: number;
  providers: string[];
};

export type UserStats = {
  total: number;
  admins: number;
  superAdmins: number;
  banned: number;
  verified: number;
  new7d: number;
  active24h: number;
};

export type UserSort = 'newest' | 'oldest' | 'name' | 'lastLogin';
export type UserFilters = {
  search: string;
  role: string | null;
  status: 'all' | 'active' | 'banned';
  period: '7' | '30' | '90' | 'all';
  sort: UserSort;
};
export const DEFAULT_USER_FILTERS: UserFilters = {
  search: '',
  role: null,
  status: 'all',
  period: 'all',
  sort: 'newest',
};

export type UserListParams = UserFilters & { page: number; limit: number };
export type UserListResponse = { users: AdminUser[]; total: number; page: number; limit: number };

const BASE = '/api/admin/users';

export function buildUserQuery(p: Partial<UserListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.role) q.set('role', p.role);
  if (p.status && p.status !== 'all') q.set('status', p.status);
  if (p.period && p.period !== 'all') q.set('days', p.period);
  if (p.sort && p.sort !== 'newest') q.set('sort', p.sort);
  return q;
}

export function hasActiveUserFilters(f: UserFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.role !== null ||
    f.status !== 'all' ||
    f.period !== 'all' ||
    f.sort !== 'newest'
  );
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${init?.method ?? 'GET'} ${url} gagal (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchUsers = (p: UserListParams) =>
  request<UserListResponse>(`${BASE}?${buildUserQuery(p)}`);
export const fetchUserStats = () => request<UserStats>(`${BASE}/stats`);
export const setUserRole = (id: string, role: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}/role`, json('POST', { role }));
export const banUser = (id: string, reason?: string, expiresIn?: number) =>
  request<{ ok: true }>(
    `${BASE}/${encodeURIComponent(id)}/ban`,
    json('POST', { reason: reason || undefined, expiresIn }),
  );
export const unbanUser = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}/unban`, json('POST', {}));
export const deleteUser = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, json('DELETE'));

/** Ban duration presets (seconds); null = permanent. */
export const BAN_DURATIONS: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: 'permanent', label: 'Permanen', seconds: null },
  { value: '1d', label: '1 hari', seconds: 86_400 },
  { value: '7d', label: '7 hari', seconds: 7 * 86_400 },
  { value: '30d', label: '30 hari', seconds: 30 * 86_400 },
];

/** True when a ban is still in force (no expiry, or expiry in the future). */
export function isBanActive(
  u: Pick<AdminUser, 'banned' | 'banExpires'>,
  now = Date.now(),
): boolean {
  if (!u.banned) return false;
  return !u.banExpires || new Date(u.banExpires).getTime() > now;
}
