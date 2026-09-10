import { Elysia, t } from 'elysia';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import { getSettings, upsertSettings } from '../settings';

export const settingsApi = new Elysia({ prefix: '/settings' })
  /** Public: login page needs this without auth to show/hide email form. */
  .get('/', async () => getSettings())

  /** Super-admin only: update toggles. */
  .put(
    '/',
    async ({ request, body }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return upsertSettings(body);
    },
    {
      body: t.Object({
        emailAuthEnabled: t.Boolean(),
        signupEnabled: t.Boolean(),
      }),
    },
  );

export type SettingsApi = typeof settingsApi;
