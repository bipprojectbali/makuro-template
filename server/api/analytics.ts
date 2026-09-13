/**
 * Analytics read/write endpoints for the super-admin /dev console.
 * All endpoints are protected by requireRole(SUPER_ADMIN).
 */
import { eq, ilike, lt, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { loginLog, rateLimitLog, visitLog } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import { loginsApi } from './analytics-logins';
import { ListQuery, pageParams } from './analytics-paging';
import { visitsApi } from './analytics-visits';

export { pageParams } from './analytics-paging';

export const analyticsApi = new Elysia({ prefix: '/analytics' })
  // Visitor logs live in analytics-visits.ts (list, stats, export, delete).
  .use(visitsApi)

  // Login logs live in analytics-logins.ts (list, stats, export, delete).
  .use(loginsApi)

  // ── Rate limit logs ───────────────────────────────────────────────────────

  .get(
    '/rate-limit-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const { page, limit, offset, order } = pageParams(query);

      const where = query.search
        ? or(
            ilike(rateLimitLog.ip, `%${query.search}%`),
            ilike(rateLimitLog.path, `%${query.search}%`),
          )
        : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: rateLimitLog.id,
            ip: rateLimitLog.ip,
            path: rateLimitLog.path,
            userId: rateLimitLog.userId,
            createdAt: rateLimitLog.createdAt,
          })
          .from(rateLimitLog)
          .where(where)
          .orderBy(order(rateLimitLog.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(rateLimitLog).where(where),
      ]);

      return { rows, total: totals?.count ?? 0, page, limit };
    },
    { query: ListQuery },
  )

  .delete('/rate-limit-logs/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(rateLimitLog)
      .where(eq(rateLimitLog.id, params.id))
      .returning({ id: rateLimitLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  })

  // ── Bulk purge (all tables, older than N days) ────────────────────────────

  .delete(
    '/purge',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const days = Math.min(Math.max(0, Number(query.days ?? 30)), 365);
      // days=0 means "delete all" — no date filter applied
      const cutoff = days === 0 ? null : new Date(Date.now() - days * 86_400_000);
      const [v, l, r] = await Promise.all([
        db
          .delete(visitLog)
          .where(cutoff ? lt(visitLog.createdAt, cutoff) : undefined)
          .returning({ id: visitLog.id }),
        db
          .delete(loginLog)
          .where(cutoff ? lt(loginLog.createdAt, cutoff) : undefined)
          .returning({ id: loginLog.id }),
        db
          .delete(rateLimitLog)
          .where(cutoff ? lt(rateLimitLog.createdAt, cutoff) : undefined)
          .returning({ id: rateLimitLog.id }),
      ]);
      return { purgedVisits: v.length, purgedLogins: l.length, purgedRateLimits: r.length };
    },
    { query: t.Object({ days: t.Optional(t.String()) }) },
  );
