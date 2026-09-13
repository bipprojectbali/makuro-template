/**
 * Rate-limit log endpoints for the super-admin console (/dev/rate-limit-logs).
 * Mounted under /analytics by analytics.ts. All routes require SUPER_ADMIN.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { rateLimitLog, user } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  buildRateLimitWhere,
  listRateLimits,
  RateLimitListQuery,
  rateLimitSelect,
  toRateLimitCsv,
} from './analytics-ratelimits.query';
import { getRateLimitStats } from './analytics-ratelimits.stats.query';

export const RATE_LIMIT_EXPORT_MAX_ROWS = 10_000;
const BULK_DELETE_MAX = 100;

export const rateLimitsApi = new Elysia()
  .get(
    '/rate-limit-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listRateLimits(query);
    },
    { query: RateLimitListQuery },
  )

  .get(
    '/rate-limit-logs/export',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const rows = await db
        .select(rateLimitSelect)
        .from(rateLimitLog)
        .leftJoin(user, eq(rateLimitLog.userId, user.id))
        .where(buildRateLimitWhere(query))
        .orderBy(desc(rateLimitLog.createdAt))
        .limit(RATE_LIMIT_EXPORT_MAX_ROWS);
      const date = new Date().toISOString().slice(0, 10);
      return new Response(toRateLimitCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="rate-limit-logs-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    },
    { query: RateLimitListQuery },
  )

  .get('/rate-limit-logs/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return getRateLimitStats();
  })

  .delete(
    '/rate-limit-logs',
    async ({ request, body }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const deleted = await db
        .delete(rateLimitLog)
        .where(inArray(rateLimitLog.id, body.ids))
        .returning({ id: rateLimitLog.id });
      return { deleted: deleted.length };
    },
    { body: t.Object({ ids: t.Array(t.String(), { minItems: 1, maxItems: BULK_DELETE_MAX }) }) },
  )

  .delete('/rate-limit-logs/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(rateLimitLog)
      .where(eq(rateLimitLog.id, params.id))
      .returning({ id: rateLimitLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  });
