/**
 * Product API at /api/app/* — default home for app feature endpoints. Every route
 * here requires a signed-in user of any role (session or API key with `app:*` scope).
 * Per-feature role limits: check `actor.role` in the handler and return 403.
 */
import { Elysia } from 'elysia';
import { resolveActor } from '../guard';

export const appApi = new Elysia({ prefix: '/app' })
  .derive(async ({ request }) => ({ actor: await resolveActor(request) }))
  .onBeforeHandle(({ actor, status }) => {
    if (!actor)
      return status(401, { error: 'Silakan masuk terlebih dahulu.', code: 'UNAUTHORIZED' });
  })
  /** Example endpoint: who is calling. Replace or extend with real features. */
  .get('/whoami', ({ actor }) => {
    const a = actor as NonNullable<typeof actor>;
    return { userId: a.user.id, name: a.user.name, role: a.role };
  });
