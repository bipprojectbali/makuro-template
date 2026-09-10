import { eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { db } from '../db';
import { user as userTable } from '../db/schema';
import {
  canActOnTarget,
  canSetRole,
  isAdminRole,
  isAssignableRole,
  normalizeRole,
  ROLES,
  type Role,
} from '../permissions';
import { resolveUserRole } from '../roles';

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
    const session = await auth.api.getSession({ headers: request.headers });
    const actorRole = session?.user ? await resolveUserRole(session.user) : null;
    return { actor: session?.user ?? null, actorRole, headers: request.headers };
  })
  .onBeforeHandle(({ actorRole, status }) => {
    if (!actorRole || !isAdminRole(actorRole)) return status(403, { error: 'Forbidden' });
  })
  .get(
    '/users',
    async ({ query, headers }) => {
      const limit = query.limit ?? 20;
      const offset = query.offset ?? 0;
      const search = query.search?.trim();
      return auth.api.listUsers({
        headers,
        query: {
          limit,
          offset,
          sortBy: 'createdAt',
          sortDirection: 'desc',
          ...(search
            ? {
                searchField: 'email' as const,
                searchOperator: 'contains' as const,
                searchValue: search,
              }
            : {}),
        },
      });
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Number({ minimum: 0 })),
        search: t.Optional(t.String()),
      }),
    },
  )
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
    async ({ actorRole, params, headers, status }) => {
      const current = await targetRole(params.id);
      if (current === null) return status(404, { error: 'User not found' });
      if (!canActOnTarget(actorRole, current))
        return status(403, { error: 'Not allowed to act on this user' });
      await auth.api.unbanUser({ headers, body: { userId: params.id } });
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
      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) },
  );

export type AdminApi = typeof adminApi;
