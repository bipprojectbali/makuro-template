/**
 * Runtime app settings (singleton row in `app_setting`).
 *
 * Auth toggles are public (the login page needs them). Rate-limit settings are
 * super-admin only and override the env defaults at runtime; NULL columns mean
 * "use the default", which the console shows as such and can reset per field.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSetting } from './db/schema';
import { env, hasGoogleAuth } from './env';
import { logger } from './logger';
import {
  DEFAULT_EXCLUDE_PREFIXES,
  type RateLimitConfig,
  rateLimiter,
} from './middleware/rate-limiter';

const SINGLETON_ID = 'singleton';

export type AuthSettings = {
  emailAuthEnabled: boolean;
  signupEnabled: boolean;
};

/** Stored overrides; null = default. */
export type RateLimitSettings = {
  rateLimitEnabled: boolean;
  rateLimitMax: number | null;
  rateLimitWindowMs: number | null;
  rateLimitExcludePrefixes: string[] | null;
};

export type AppSettings = AuthSettings & RateLimitSettings;

export const AUTH_DEFAULTS: AuthSettings = { emailAuthEnabled: false, signupEnabled: true };
export const RATE_LIMIT_SETTINGS_DEFAULTS: RateLimitSettings = {
  rateLimitEnabled: true,
  rateLimitMax: null,
  rateLimitWindowMs: null,
  rateLimitExcludePrefixes: null,
};

/** The env-derived defaults a NULL override falls back to. */
export function rateLimitDefaults(): { max: number; windowMs: number; excludePrefixes: string[] } {
  return {
    max: env.RATE_LIMIT_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    excludePrefixes: DEFAULT_EXCLUDE_PREFIXES,
  };
}

/** Resolve stored overrides + defaults into the config the limiter runs with. */
export function effectiveRateLimit(s: RateLimitSettings): RateLimitConfig & { enabled: boolean } {
  const d = rateLimitDefaults();
  return {
    enabled: s.rateLimitEnabled,
    limit: s.rateLimitMax ?? d.max,
    windowMs: s.rateLimitWindowMs ?? d.windowMs,
    excludePrefixes: s.rateLimitExcludePrefixes ?? d.excludePrefixes,
  };
}

function parsePrefixes(raw: string | null): string[] | null {
  if (raw === null) return null;
  return raw
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Read all settings. Returns defaults if no row exists yet. */
export async function getSettings(): Promise<AppSettings> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.id, SINGLETON_ID)).limit(1);
  if (!row) return { ...AUTH_DEFAULTS, ...RATE_LIMIT_SETTINGS_DEFAULTS };
  return {
    emailAuthEnabled: row.emailAuthEnabled,
    signupEnabled: row.signupEnabled,
    rateLimitEnabled: row.rateLimitEnabled,
    rateLimitMax: row.rateLimitMax,
    rateLimitWindowMs: row.rateLimitWindowMs,
    rateLimitExcludePrefixes: parsePrefixes(row.rateLimitExcludePrefixes),
  };
}

type Row = typeof appSetting.$inferInsert;

async function upsert(values: Partial<Row>): Promise<AppSettings> {
  await db
    .insert(appSetting)
    .values({ id: SINGLETON_ID, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSetting.id, set: { ...values, updatedAt: new Date() } });
  return getSettings();
}

/** Persist auth toggles (public-facing behaviour). */
export async function upsertSettings(settings: AuthSettings): Promise<AppSettings> {
  return upsert(settings);
}

/** Persist rate-limit overrides and apply them to the running limiter immediately. */
export async function upsertRateLimitSettings(settings: RateLimitSettings): Promise<AppSettings> {
  const saved = await upsert({
    rateLimitEnabled: settings.rateLimitEnabled,
    rateLimitMax: settings.rateLimitMax,
    rateLimitWindowMs: settings.rateLimitWindowMs,
    rateLimitExcludePrefixes: settings.rateLimitExcludePrefixes
      ? settings.rateLimitExcludePrefixes.join('\n')
      : null,
  });
  rateLimiter.configure(effectiveRateLimit(saved));
  return saved;
}

/**
 * Load stored rate-limit overrides into the process-wide limiter. Called once
 * at API boot; a DB failure keeps the env defaults and is logged, never thrown.
 */
export async function applyRateLimitSettings(): Promise<void> {
  try {
    rateLimiter.configure(effectiveRateLimit(await getSettings()));
  } catch (err) {
    logger.warn({ err }, 'could not load rate-limit settings; using env defaults');
  }
}

export type SettingsOverview = {
  settings: AppSettings;
  rateLimit: {
    defaults: ReturnType<typeof rateLimitDefaults>;
    effective: ReturnType<typeof effectiveRateLimit>;
  };
  runtime: { nodeEnv: string; appUrl: string; googleAuthConfigured: boolean; mcpEnabled: boolean };
};

/** Everything the settings console shows: stored values, defaults, effective config, runtime facts. */
export async function settingsOverview(): Promise<SettingsOverview> {
  const settings = await getSettings();
  return {
    settings,
    rateLimit: { defaults: rateLimitDefaults(), effective: effectiveRateLimit(settings) },
    runtime: {
      nodeEnv: env.NODE_ENV,
      appUrl: env.APP_URL,
      googleAuthConfigured: hasGoogleAuth,
      mcpEnabled: Boolean(env.MCP_ADMIN_TOKEN),
    },
  };
}
