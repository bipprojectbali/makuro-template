import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  getSettings,
  RATE_LIMIT_SETTINGS_DEFAULTS,
  settingsOverview,
  upsertRateLimitSettings,
  upsertSettings,
} from '../settings';
import { getBranding } from '../settings-branding';
import { flagsToMap, getFeatureFlags } from '../settings-features';

const PREFIX = t.String({ pattern: '^/', minLength: 1, maxLength: 200 });
const MAX_RATE = 100_000;
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 24 * 3_600_000;

export const settingsApi = new Elysia({ prefix: '/settings' })
  /** Public: login page needs this without auth to show/hide email form. */
  .get('/', async () => {
    const [{ emailAuthEnabled, signupEnabled }, flags, branding] = await Promise.all([
      getSettings(),
      getFeatureFlags(),
      getBranding(),
    ]);
    return { emailAuthEnabled, signupEnabled, features: flagsToMap(flags), branding };
  })

  /** Super-admin: everything, plus defaults/effective values and read-only runtime facts. */
  .get('/all', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return settingsOverview();
  })

  /** Super-admin only: update auth toggles. */
  .put(
    '/',
    async ({ request, body }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const saved = await upsertSettings(body);
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_AUTH_UPDATE,
        targetType: 'settings',
        targetId: 'auth',
        summary: `Autentikasi: login email ${body.emailAuthEnabled ? 'aktif' : 'nonaktif'}, pendaftaran ${body.signupEnabled ? 'dibuka' : 'ditutup'}`,
        meta: body,
      });
      return saved;
    },
    { body: t.Object({ emailAuthEnabled: t.Boolean(), signupEnabled: t.Boolean() }) },
  )

  /** Super-admin only: rate-limit overrides (null = default). Applied immediately. */
  .put(
    '/rate-limit',
    async ({ request, body }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_RATE_LIMIT_UPDATE,
        targetType: 'settings',
        targetId: 'rate-limit',
        summary: body.rateLimitEnabled
          ? `Rate limit diubah: ${body.rateLimitMax ?? 'default'} / ${body.rateLimitWindowMs ?? 'default'} ms`
          : 'Rate limiting dimatikan',
        meta: body,
      });
      return upsertRateLimitSettings({
        rateLimitEnabled: body.rateLimitEnabled,
        rateLimitMax: body.rateLimitMax ?? null,
        rateLimitWindowMs: body.rateLimitWindowMs ?? null,
        rateLimitExcludePrefixes: body.rateLimitExcludePrefixes ?? null,
      });
    },
    {
      body: t.Object({
        rateLimitEnabled: t.Boolean(),
        rateLimitMax: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: MAX_RATE }))),
        rateLimitWindowMs: t.Optional(
          t.Nullable(t.Integer({ minimum: MIN_WINDOW_MS, maximum: MAX_WINDOW_MS })),
        ),
        rateLimitExcludePrefixes: t.Optional(t.Nullable(t.Array(PREFIX, { maxItems: 50 }))),
      }),
    },
  )

  /** Super-admin only: drop all rate-limit overrides (back to env defaults, enabled). */
  .delete('/rate-limit', async ({ request }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.SETTINGS_RATE_LIMIT_RESET,
      targetType: 'settings',
      targetId: 'rate-limit',
      summary: 'Rate limit dikembalikan ke default',
    });
    return upsertRateLimitSettings(RATE_LIMIT_SETTINGS_DEFAULTS);
  });

export type SettingsApi = typeof settingsApi;
