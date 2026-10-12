/** Access-mode settings: maintenance + demo sandbox (super-admin). Nested in settingsOpsApi, inherits `/settings`. */
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { requireRole, resolveActor } from '../guard';
import { ROLES } from '../permissions';
import { DEMO_DEFAULTS, upsertDemo } from '../settings-demo';
import { upsertMaintenance } from '../settings-maintenance';

const ROLE = t.Union([t.Literal(ROLES.USER), t.Literal(ROLES.ADMIN), t.Literal(ROLES.SUPER_ADMIN)]);

export const settingsAccessApi = new Elysia()
  .put(
    '/maintenance',
    async ({ request, body }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const saved = await upsertMaintenance({
        enabled: body.enabled,
        message: body.message ?? null,
        allowRoles: body.allowRoles ?? null,
      });
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_MAINTENANCE_UPDATE,
        targetType: 'settings',
        targetId: 'maintenance',
        summary: body.enabled ? 'Mode maintenance DIAKTIFKAN' : 'Mode maintenance dimatikan',
        meta: body,
      });
      return saved;
    },
    {
      body: t.Object({
        enabled: t.Boolean(),
        message: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        allowRoles: t.Optional(t.Nullable(t.Array(ROLE, { maxItems: 3 }))),
      }),
    },
  )
  .put(
    '/demo',
    async ({ request, body, status }) => {
      const actor = await resolveActor(request);
      if (!actor) return status(401, { error: 'Masuk dulu untuk mengubah pengaturan demo.' });
      if (actor.role !== ROLES.SUPER_ADMIN)
        return status(403, { error: 'Hanya super-admin yang bisa mengubah pengaturan demo.' });
      const saved = await upsertDemo(body);
      void audit({
        actor: actor.user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SETTINGS_DEMO_UPDATE,
        targetType: 'settings',
        targetId: 'demo',
        summary: `Mode demo ${body.enabled ? 'DIAKTIFKAN' : 'dimatikan'} (TTL ${body.ttlHours ?? `default ${DEMO_DEFAULTS.ttlHours}`} jam)`,
        meta: body,
      });
      return saved;
    },
    {
      body: t.Object({
        enabled: t.Boolean(),
        ttlHours: t.Nullable(t.Integer({ minimum: 1, maximum: DEMO_DEFAULTS.maxTtlHours })),
      }),
    },
  );
