/** Typed client for /api/settings used by /dev/settings. */

export type AuthSettings = { emailAuthEnabled: boolean; signupEnabled: boolean };

export type RateLimitSettings = {
  rateLimitEnabled: boolean;
  rateLimitMax: number | null;
  rateLimitWindowMs: number | null;
  rateLimitExcludePrefixes: string[] | null;
};

export type AppSettings = AuthSettings & RateLimitSettings;

export type SettingsOverview = {
  settings: AppSettings;
  rateLimit: {
    defaults: { max: number; windowMs: number; excludePrefixes: string[] };
    effective: { limit: number; windowMs: number; excludePrefixes: string[]; enabled: boolean };
  };
  runtime: { nodeEnv: string; appUrl: string; googleAuthConfigured: boolean; mcpEnabled: boolean };
};

const BASE = '/api/settings';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `${init?.method ?? 'GET'} ${url} gagal (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const fetchSettingsOverview = () => request<SettingsOverview>(`${BASE}/all`);
export const saveAuthSettings = (s: AuthSettings) => request<AppSettings>(BASE, json('PUT', s));
export const saveRateLimitSettings = (s: RateLimitSettings) =>
  request<AppSettings>(`${BASE}/rate-limit`, json('PUT', s));
export const resetRateLimitSettings = () =>
  request<AppSettings>(`${BASE}/rate-limit`, json('DELETE'));

export function pickAuth(s: AppSettings): AuthSettings {
  return { emailAuthEnabled: s.emailAuthEnabled, signupEnabled: s.signupEnabled };
}

export function pickRateLimit(s: AppSettings): RateLimitSettings {
  return {
    rateLimitEnabled: s.rateLimitEnabled,
    rateLimitMax: s.rateLimitMax,
    rateLimitWindowMs: s.rateLimitWindowMs,
    rateLimitExcludePrefixes: s.rateLimitExcludePrefixes,
  };
}

export function sameRateLimit(a: RateLimitSettings, b: RateLimitSettings): boolean {
  return (
    a.rateLimitEnabled === b.rateLimitEnabled &&
    a.rateLimitMax === b.rateLimitMax &&
    a.rateLimitWindowMs === b.rateLimitWindowMs &&
    JSON.stringify(a.rateLimitExcludePrefixes) === JSON.stringify(b.rateLimitExcludePrefixes)
  );
}
