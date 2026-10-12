/** Settings groups beyond auth/rate-limit: retention, feature flags, branding, access modes (super-admin). */
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import { upsertBranding } from '../settings-branding';
import { FLAG_KEY_RE, MAX_FLAGS, upsertFeatureFlags } from '../settings-features';
import {
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  runRetention,
  upsertRetention,
} from '../settings-retention';
import { settingsAccessApi } from './settings-access';

const Days = t.Nullable(t.Integer({ minimum: RETENTION_MIN_DAYS, maximum: RETENTION_MAX_DAYS }));

export const settingsOpsApi = new Elysia({ prefix: '/settings' })
  .use(settingsAccessApi)
  .put(
    '/retention',
    async ({ request, body }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const saved = await upsertRetention(body);
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_RETENTION_UPDATE,
        targetType: 'settings',
        targetId: 'retention',
        summary: `Retensi log diubah (visit ${body.visitDays ?? '∞'}, login ${body.loginDays ?? '∞'}, rate-limit ${body.rateLimitDays ?? '∞'}, audit ${body.auditDays ?? '∞'} hari)`,
        meta: body,
      });
      return saved;
    },
    {
      body: t.Object({
        visitDays: Days,
        loginDays: Days,
        rateLimitDays: Days,
        auditDays: Days,
        apiUsageDays: Days,
      }),
    },
  )
  .post('/retention/run', async ({ request }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const result = await runRetention('manual');
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.LOGS_RETENTION,
      targetType: 'logs',
      summary: 'Retensi dijalankan manual',
      meta: result,
    });
    return result;
  })
  .put(
    '/features',
    async ({ request, body, status }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      try {
        const saved = await upsertFeatureFlags(body.flags);
        void audit({
          actor: user,
          headers: request.headers,
          action: AUDIT_ACTIONS.SETTINGS_FEATURES_UPDATE,
          targetType: 'settings',
          targetId: 'features',
          summary: `Feature flags diubah: ${
            saved
              .filter((f) => f.enabled)
              .map((f) => f.key)
              .join(', ') || 'tidak ada yang aktif'
          }`,
          meta: { flags: saved },
        });
        return { flags: saved };
      } catch (err) {
        return status(400, { error: (err as Error).message });
      }
    },
    {
      body: t.Object({
        flags: t.Array(
          t.Object({
            key: t.String({
              pattern: FLAG_KEY_RE.source,
              maxLength: 60,
            }),
            enabled: t.Boolean(),
            description: t.String({ maxLength: 200 }),
          }),
          { maxItems: MAX_FLAGS },
        ),
      }),
    },
  )
  .put(
    '/branding',
    async ({ request, body }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const saved = await upsertBranding({
        appName: body.appName ?? null,
        appTagline: body.appTagline ?? null,
        supportUrl: body.supportUrl ?? null,
      });
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_BRANDING_UPDATE,
        targetType: 'settings',
        targetId: 'branding',
        summary: `Branding diubah (nama: ${body.appName?.trim() || 'default'})`,
        meta: body,
      });
      return saved;
    },
    {
      body: t.Object({
        appName: t.Optional(t.Nullable(t.String({ maxLength: 60 }))),
        appTagline: t.Optional(t.Nullable(t.String({ maxLength: 140 }))),
        supportUrl: t.Optional(t.Nullable(t.String({ maxLength: 300 }))),
      }),
    },
  );
