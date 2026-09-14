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

// ── Retention / maintenance / feature flags / branding ───────────────────────

export type RetentionSettings = {
  visitDays: number | null;
  loginDays: number | null;
  rateLimitDays: number | null;
  auditDays: number | null;
};
export type RetentionResult = {
  ranAt: string;
  deleted: Record<keyof RetentionSettings, number>;
  trigger: 'schedule' | 'manual';
};
export type RetentionState = RetentionSettings & {
  lastRunAt: string | null;
  lastResult: RetentionResult | null;
};
export type MaintenanceSettings = {
  enabled: boolean;
  message: string | null;
  allowRoles: string[] | null;
};
export type FeatureFlag = { key: string; enabled: boolean; description: string };
export type BrandingSettings = {
  appName: string | null;
  appTagline: string | null;
  supportUrl: string | null;
};
export type Branding = { appName: string; appTagline: string; supportUrl: string | null };

export type SettingsOverviewFull = SettingsOverview & {
  retention: RetentionState;
  maintenance: MaintenanceSettings & {
    defaults: { message: string; allowRoles: string[]; retryAfterSeconds: number };
  };
  features: FeatureFlag[];
  branding: { settings: BrandingSettings; defaults: Branding; effective: Branding };
};

export const fetchSettingsOverviewFull = () => request<SettingsOverviewFull>(`${BASE}/all`);
export const saveRetention = (s: RetentionSettings) =>
  request<RetentionState>(`${BASE}/retention`, json('PUT', s));
export const runRetentionNow = () =>
  request<RetentionResult>(`${BASE}/retention/run`, json('POST', {}));
export const saveMaintenance = (s: MaintenanceSettings) =>
  request<MaintenanceSettings>(`${BASE}/maintenance`, json('PUT', s));
export const saveFeatureFlags = (flags: FeatureFlag[]) =>
  request<{ flags: FeatureFlag[] }>(`${BASE}/features`, json('PUT', { flags }));
export const saveBranding = (s: BrandingSettings) =>
  request<BrandingSettings>(`${BASE}/branding`, json('PUT', s));

export function sameRetention(a: RetentionSettings, b: RetentionSettings): boolean {
  return (
    a.visitDays === b.visitDays &&
    a.loginDays === b.loginDays &&
    a.rateLimitDays === b.rateLimitDays &&
    a.auditDays === b.auditDays
  );
}
