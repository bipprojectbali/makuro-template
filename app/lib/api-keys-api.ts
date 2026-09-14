/** Typed client for /api/api-keys (super-admin key management). The plain key is only ever in create/rotate responses. */

export type ApiKeyStatus = 'active' | 'disabled' | 'expired' | 'revoked' | 'rotating';

export type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerImage: string | null;
  ownerRole: string | null;
  enabled: boolean | null;
  rateLimitEnabled: boolean | null;
  rateLimitTimeWindow: number | null;
  rateLimitMax: number | null;
  lastRequest: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  rotatedFromId: string | null;
  allowedIps: string | null;
  note: string | null;
  lastIp: string | null;
  lastCountry: string | null;
  revokedAt: string | null;
  usage24h: number;
  scopes: string[];
  status: ApiKeyStatus;
};

export type ApiKeyStats = {
  total: number;
  active: number;
  expiringSoon: number;
  revoked: number;
  owners: number;
  usage24h: number;
  errors24h: number;
  expiringSoonDays: number;
};

export type ScopeDef = { id: string; label: string; description: string; minRole: string };

export type ApiKeyInput = {
  name: string;
  ownerId: string;
  scopes: string[];
  expiresDays: number | null;
  rateLimitMax: number | null;
  rateLimitWindowMs: number | null;
  allowedIps: string[] | null;
  note: string | null;
};
export type ApiKeyPatch = Partial<Omit<ApiKeyInput, 'ownerId'>> & { enabled?: boolean };

export type UsageSummary = {
  total: number;
  last24h: number;
  last7d: number;
  errors24h: number;
  avgMs: number;
};
export type UsageBreakdown = {
  endpoints: Array<{ key: string; count: number }>;
  ips: Array<{ key: string | null; count: number }>;
  countries: Array<{ key: string | null; count: number }>;
  daily: Array<{ day: string; count: number; errors: number }>;
};
export type UsageRecentRow = {
  id: string;
  keyId: string;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  durationMs: number | null;
  createdAt: string;
};
export type ApiKeyUsage = {
  summary: UsageSummary;
  breakdown: UsageBreakdown;
  recent: UsageRecentRow[];
};

export type ApiKeyFilters = {
  search: string;
  status: ApiKeyStatus | 'all';
  ownerId: string | null;
  scope: string | null;
};
export const DEFAULT_KEY_FILTERS: ApiKeyFilters = {
  search: '',
  status: 'all',
  ownerId: null,
  scope: null,
};
export type ApiKeyListParams = ApiKeyFilters & { page: number; limit: number };
export type ApiKeyListResponse = {
  rows: ApiKeyRow[];
  total: number;
  page: number;
  limit: number;
};

const BASE = '/api/api-keys';

export function buildKeyQuery(p: Partial<ApiKeyListParams>): URLSearchParams {
  const q = new URLSearchParams();
  if (p.page) q.set('page', String(p.page));
  if (p.limit) q.set('limit', String(p.limit));
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.status && p.status !== 'all') q.set('status', p.status);
  if (p.ownerId) q.set('ownerId', p.ownerId);
  if (p.scope) q.set('scope', p.scope);
  return q;
}

export function hasActiveKeyFilters(f: ApiKeyFilters): boolean {
  return f.search.trim() !== '' || f.status !== 'all' || f.ownerId !== null || f.scope !== null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${init?.method ?? 'GET'} ${url} gagal (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
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

export const fetchApiKeys = (p: ApiKeyListParams) =>
  request<ApiKeyListResponse>(`${BASE}?${buildKeyQuery(p)}`);
export const fetchApiKeyStats = () => request<ApiKeyStats>(`${BASE}/stats`);
export const fetchScopes = () => request<{ scopes: ScopeDef[] }>(`${BASE}/scopes`);
export const fetchApiKey = (id: string) => request<ApiKeyRow>(`${BASE}/${encodeURIComponent(id)}`);
export const fetchApiKeyUsage = (id: string) =>
  request<ApiKeyUsage>(`${BASE}/${encodeURIComponent(id)}/usage`);
export const createApiKey = (input: ApiKeyInput) =>
  request<{ key: string; row: ApiKeyRow }>(BASE, json('POST', input));
export const updateApiKey = (id: string, patch: ApiKeyPatch) =>
  request<ApiKeyRow>(`${BASE}/${encodeURIComponent(id)}`, json('PUT', patch));
export const rotateApiKey = (id: string) =>
  request<{ key: string; row: ApiKeyRow; old: ApiKeyRow }>(
    `${BASE}/${encodeURIComponent(id)}/rotate`,
    json('POST', {}),
  );
export const revokeApiKey = (id: string) =>
  request<ApiKeyRow>(`${BASE}/${encodeURIComponent(id)}/revoke`, json('POST', {}));
export const deleteApiKey = (id: string) =>
  request<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ── Presentation helpers ─────────────────────────────────────────────────────

export const STATUS_META: Record<ApiKeyStatus, { label: string; color: string; hint: string }> = {
  active: { label: 'Aktif', color: 'teal', hint: 'Bisa dipakai' },
  rotating: { label: 'Rotasi', color: 'yellow', hint: 'Masa tenggang; sudah ada kunci pengganti' },
  disabled: { label: 'Nonaktif', color: 'gray', hint: 'Ditolak sampai diaktifkan lagi' },
  expired: { label: 'Kedaluwarsa', color: 'orange', hint: 'Lewat tanggal berakhir' },
  revoked: { label: 'Dicabut', color: 'red', hint: 'Permanen; hanya riwayat' },
};

/** Masked display form, e.g. `mk_live_ab12…` — the plain key is never available here. */
export function maskedKey(k: Pick<ApiKeyRow, 'start' | 'prefix'>): string {
  return `${k.start ?? k.prefix ?? 'mk_live_'}…`;
}

export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export function rateLimitLabel(k: Pick<ApiKeyRow, 'rateLimitMax' | 'rateLimitTimeWindow'>): string {
  if (!k.rateLimitMax) return 'Tanpa batas khusus';
  const sec = Math.round((k.rateLimitTimeWindow ?? 0) / 1000);
  const win =
    sec >= 3600
      ? `${Math.round(sec / 3600)} jam`
      : sec >= 60
        ? `${Math.round(sec / 60)} mnt`
        : `${sec} dtk`;
  return `${k.rateLimitMax} req / ${win}`;
}

export const EXPIRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari (disarankan)' },
  { value: '180', label: '180 hari' },
  { value: '365', label: '1 tahun' },
  { value: 'never', label: 'Tanpa kedaluwarsa (super-admin)' },
];
