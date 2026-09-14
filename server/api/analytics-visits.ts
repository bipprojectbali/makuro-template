/**
 * Visitor log endpoints for the super-admin console (/dev/visits).
 * Mounted under /analytics by analytics.ts. All routes require SUPER_ADMIN.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { AUDIT_ACTIONS, audit } from '../audit';
import { db } from '../db';
import { user, visitLog } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  buildVisitWhere,
  listVisits,
  toCsv,
  VisitListQuery,
  visitSelect,
} from './analytics-visits.query';
import { getVisitStats } from './analytics-visits.stats.query';

/** Hard cap for CSV export — keeps memory bounded on large tables. */
export const EXPORT_MAX_ROWS = 10_000;
const BULK_DELETE_MAX = 100;

export const visitsApi = new Elysia()
  .get(
    '/visits',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listVisits(query);
    },
    { query: VisitListQuery },
  )

  .get(
    '/visits/export',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const rows = await db
        .select(visitSelect)
        .from(visitLog)
        .leftJoin(user, eq(visitLog.userId, user.id))
        .where(buildVisitWhere(query))
        .orderBy(desc(visitLog.createdAt))
        .limit(EXPORT_MAX_ROWS);

      const date = new Date().toISOString().slice(0, 10);
      return new Response(toCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="visit-logs-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    },
    { query: VisitListQuery },
  )

  .get('/visits/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return getVisitStats();
  })

  .delete(
    '/visits',
    async ({ request, body }) => {
      const { user: actor } = await requireRole(request, ROLES.SUPER_ADMIN);
      const deleted = await db
        .delete(visitLog)
        .where(inArray(visitLog.id, body.ids))
        .returning({ id: visitLog.id });
      void audit({
        actor,
        headers: request.headers,
        action: AUDIT_ACTIONS.LOGS_DELETE,
        targetType: 'logs',
        summary: `${deleted.length} visit log dihapus massal`,
        meta: { kind: 'visit', count: deleted.length },
      });
      return { deleted: deleted.length };
    },
    { body: t.Object({ ids: t.Array(t.String(), { minItems: 1, maxItems: BULK_DELETE_MAX }) }) },
  )

  .delete('/visits/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(visitLog)
      .where(eq(visitLog.id, params.id))
      .returning({ id: visitLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  });
