import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { auth } from '../auth';
import { db } from '../db';
import { user as userTable } from '../db/schema';
import { resolveActor } from '../guard';
import {
  canActOnTarget,
  canSetRole,
  isAdminRole,
  isAssignableRole,
  normalizeRole,
  ROLES,
  type Role,
} from '../permissions';
import { adminUserStats, listAdminUsers, UserListQuery } from './admin-users.query';

async function targetRole(id: string): Promise<Role | null> {
  const [row] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);
  return row ? normalizeRole(row.role) : null;
}

/**
 * Admin console API (`/api/admin/*`). Wraps Better Auth's admin endpoints so
 * the role matrix is enforced server-side: admins may view + ban regular
 * users; only super-admins may change roles or delete. super-admin accounts
 * are env-controlled and cannot be mutated here.
 */
export const adminApi = new Elysia({ prefix: '/admin' })
  .derive(async ({ request }) => {
    const who = await resolveActor(request);
    return { actor: who?.user ?? null, actorRole: who?.role ?? null, headers: request.headers };
  })
  .onBeforeHandle(({ actorRole, status }) => {
    if (!actorRole || !isAdminRole(actorRole)) return status(403, { error: 'Forbidden' });
  })
  .get('/users', ({ query }) => listAdminUsers(query), { query: UserListQuery })
  .get('/users/stats', () => adminUserStats())
  .post(
    '/users/:id/role',
    async ({ actor, actorRole, params, body, headers, status }) => {
      if (!canSetRole(actorRole))
        return status(403, { error: 'Only super-admin can change roles' });
      if (params.id === actor?.id) return status(400, { error: 'Cannot change your own role' });
      if (!isAssignableRole(body.role)) return status(400, { error: 'Invalid role' });
      const current = await targetRole(params.id);
      if (current === null) return status(404, { error: 'User not found' });
      if (current === ROLES.SUPER_ADMIN)
        return status(400, { error: 'super-admin is managed via SUPER_ADMIN_EMAILS' });
      await auth.api.setRole({ headers, body: { userId: params.id, role: body.role } });
      void audit({
        actor,
        headers,
        action: AUDIT_ACTIONS.USER_ROLE_SET,
        targetType: 'user',
        targetId: params.id,
        summary: `Role user diubah dari ${current} ke ${body.role}`,
        meta: { from: current, to: body.role },
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }), body: t.Object({ role: t.String() }) },
  )
  .post(
    '/users/:id/ban',
    async ({ actor, actorRole, params, body, headers, status }) => {
      if (params.id === actor?.id) return status(400, { error: 'Cannot ban yourself' });
      const current = await targetRole(params.id);
      if (current === null) return status(404, { error: 'User not found' });
      if (current === ROLES.SUPER_ADMIN) return status(400, { error: 'Cannot ban a super-admin' });
      if (!canActOnTarget(actorRole, current))
        return status(403, { error: 'Not allowed to act on this user' });
      await auth.api.banUser({
        headers,
        body: { userId: params.id, banReason: body.reason, banExpiresIn: body.expiresIn },
      });
      void audit({
        actor,
        headers,
        action: AUDIT_ACTIONS.USER_BAN,
        targetType: 'user',
        targetId: params.id,
        summary: `User diblokir${body.expiresIn ? ` selama ${Math.round(body.expiresIn / 86_400)} hari` : ' permanen'}${body.reason ? `: ${body.reason}` : ''}`,
        meta: { reason: body.reason ?? null, expiresIn: body.expiresIn ?? null },
      });
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.String()),
        expiresIn: t.Optional(t.Number({ minimum: 1 })),
      }),
    },
  )
  .post(
    '/users/:id/unban',
    async ({ actor, actorRole, params, headers, status }) => {
      const current = await targetRole(params.id);
      if (current === null) return status(404, { error: 'User not found' });
      if (!canActOnTarget(actorRole, current))
        return status(403, { error: 'Not allowed to act on this user' });
      await auth.api.unbanUser({ headers, body: { userId: params.id } });
      void audit({
        actor,
        headers,
        action: AUDIT_ACTIONS.USER_UNBAN,
        targetType: 'user',
        targetId: params.id,
        summary: 'Ban user dibuka',
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .delete(
    '/users/:id',
    async ({ actor, actorRole, params, headers, status }) => {
      if (!canSetRole(actorRole))
        return status(403, { error: 'Only super-admin can delete users' });
      if (params.id === actor?.id) return status(400, { error: 'Cannot delete yourself' });
      const current = await targetRole(params.id);
      if (current === null) return status(404, { error: 'User not found' });
      if (current === ROLES.SUPER_ADMIN)
        return status(400, { error: 'Cannot delete a super-admin' });
      await auth.api.removeUser({ headers, body: { userId: params.id } });
      void audit({
        actor,
        headers,
        action: AUDIT_ACTIONS.USER_DELETE,
        targetType: 'user',
        targetId: params.id,
        summary: 'User dihapus permanen',
        meta: { role: current },
      });
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export type AdminApi = typeof adminApi;
