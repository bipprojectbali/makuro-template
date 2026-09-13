/**
 * Login log endpoints for the super-admin console (/dev/login-logs).
 * Mounted under /analytics by analytics.ts. All routes require SUPER_ADMIN.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { loginLog, user } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  buildLoginWhere,
  LoginListQuery,
  listLogins,
  loginSelect,
  toLoginCsv,
} from './analytics-logins.query';
import { getLoginStats } from './analytics-logins.stats.query';

export const LOGIN_EXPORT_MAX_ROWS = 10_000;
const BULK_DELETE_MAX = 100;

export const loginsApi = new Elysia()
  .get(
    '/login-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listLogins(query);
    },
    { query: LoginListQuery },
  )

  .get(
    '/login-logs/export',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const rows = await db
        .select(loginSelect)
        .from(loginLog)
        .leftJoin(user, eq(loginLog.userId, user.id))
        .where(buildLoginWhere(query))
        .orderBy(desc(loginLog.createdAt))
        .limit(LOGIN_EXPORT_MAX_ROWS);
      const date = new Date().toISOString().slice(0, 10);
      return new Response(toLoginCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="login-logs-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    },
    { query: LoginListQuery },
  )

  .get('/login-logs/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return getLoginStats();
  })

  .delete(
    '/login-logs',
    async ({ request, body }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const deleted = await db
        .delete(loginLog)
        .where(inArray(loginLog.id, body.ids))
        .returning({ id: loginLog.id });
      return { deleted: deleted.length };
    },
    { body: t.Object({ ids: t.Array(t.String(), { minItems: 1, maxItems: BULK_DELETE_MAX }) }) },
  )

  .delete('/login-logs/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(loginLog)
      .where(eq(loginLog.id, params.id))
      .returning({ id: loginLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  });
