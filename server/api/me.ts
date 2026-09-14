/**
 * Endpoints about the signed-in user themselves (any role). Built on the same
 * queries as the admin console but always scoped to the session's user id.
 */
import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { listLogins } from './analytics-logins.query';

const MAX_LIMIT = 50;

export const meApi = new Elysia({ prefix: '/me' })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { me: session?.user ?? null };
  })
  .onBeforeHandle(({ me, status }) => {
    if (!me) return status(401, { error: 'Unauthorized' });
  })
  /** Recent sign-ins of the current user (newest first). */
  .get(
    '/logins',
    async ({ me, query }) => {
      const limit = Math.min(Math.max(1, Number(query.limit ?? 10) || 10), MAX_LIMIT);
      // me is non-null past the guard
      const { rows, total } = await listLogins({
        userId: (me as { id: string }).id,
        limit: String(limit),
      });
      return { rows, total };
    },
    { query: t.Object({ limit: t.Optional(t.String()) }) },
  );
