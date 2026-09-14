/** Session management endpoints for the super-admin console (/dev/sessions). */
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  listSessions,
  revokeSessionById,
  revokeUserSessions,
  SessionListQuery,
  sessionStats,
} from './sessions.query';

export const sessionsApi = new Elysia({ prefix: '/sessions' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listSessions(query);
    },
    { query: SessionListQuery },
  )
  .get('/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return sessionStats();
  })
  /** Revoke one session by row id (never by token). */
  .delete('/:id', async ({ request, params, status }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const d = await revokeSessionById(params.id);
    if (!d) return status(404, { error: 'Session not found' });
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.SESSION_REVOKE,
      targetType: 'session',
      targetId: params.id,
      summary: 'Satu sesi dicabut',
      meta: { userId: d.userId },
    });
    return { ok: true };
  })
  /** Revoke every session of a user. `keep` = session id to leave alone (e.g. the admin's own). */
  .delete(
    '/user/:userId',
    async ({ request, params, query }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const revoked = await revokeUserSessions(params.userId, query.keep);
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.SESSION_REVOKE,
        targetType: 'user',
        targetId: params.userId,
        summary: `${revoked} sesi user dicabut`,
        meta: { revoked },
      });
      return { revoked };
    },
    { query: t.Object({ keep: t.Optional(t.String()) }) },
  );
