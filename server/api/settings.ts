import { Elysia, t } from 'elysia';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  getSettings,
  RATE_LIMIT_SETTINGS_DEFAULTS,
  settingsOverview,
  upsertRateLimitSettings,
  upsertSettings,
} from '../settings';

const PREFIX = t.String({ pattern: '^/', minLength: 1, maxLength: 200 });
const MAX_RATE = 100_000;
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 24 * 3_600_000;

export const settingsApi = new Elysia({ prefix: '/settings' })
  /** Public: login page needs this without auth to show/hide email form. */
  .get('/', async () => {
    const { emailAuthEnabled, signupEnabled } = await getSettings();
    return { emailAuthEnabled, signupEnabled };
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
      await requireRole(request, ROLES.SUPER_ADMIN);
      return upsertSettings(body);
    },
    { body: t.Object({ emailAuthEnabled: t.Boolean(), signupEnabled: t.Boolean() }) },
  )

  /** Super-admin only: rate-limit overrides (null = default). Applied immediately. */
  .put(
    '/rate-limit',
    async ({ request, body }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
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
    await requireRole(request, ROLES.SUPER_ADMIN);
    return upsertRateLimitSettings(RATE_LIMIT_SETTINGS_DEFAULTS);
  });

export type SettingsApi = typeof settingsApi;
