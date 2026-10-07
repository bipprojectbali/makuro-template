/**
 * Product API at /api/app/* — default home for app feature endpoints. Every route
 * here requires a signed-in user of any role (session or API key with `app:*` scope).
 * Per-feature role limits: check `actor.role` in the handler and return 403.
 */
import { Elysia, t } from 'elysia';
import { resolveActor } from '../guard';
import { removeAvatar, uploadAvatar } from './app-avatar';

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
  })
  /** Upload/replace the caller's profile photo (multipart field `file`, PNG/JPEG/WEBP/GIF ≤ 2 MB). */
  .post(
    '/avatar',
    async ({ actor, body, status }) => {
      const a = actor as NonNullable<typeof actor>;
      const r = await uploadAvatar(a.user.id, a.user.image, body.file);
      return r.ok ? { image: r.image } : status(r.status, { error: r.error, code: r.code });
    },
    { body: t.Object({ file: t.Optional(t.File()) }) },
  )
  /** Remove the caller's profile photo. */
  .delete('/avatar', async ({ actor, status }) => {
    const a = actor as NonNullable<typeof actor>;
    const r = await removeAvatar(a.user.id, a.user.image);
    return r.ok ? { image: r.image } : status(r.status, { error: r.error, code: r.code });
  });
