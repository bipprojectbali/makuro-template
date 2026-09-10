/**
 * Analytics read endpoints for the super-admin /dev console.
 * All endpoints are protected by requireRole(SUPER_ADMIN).
 * All lists are paginated (cursor = ISO timestamp for keyset pagination).
 */
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { loginLog, rateLimitLog, visitLog } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';

const PAGE = 50;

const CursorSchema = t.Optional(t.String({ description: 'ISO timestamp cursor' }));

export const analyticsApi = new Elysia({ prefix: '/analytics' })
  // Visits list — newest first, optional bot filter, keyset pagination.
  .get(
    '/visits',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const before = query.before ? new Date(query.before) : undefined;
      const rows = await db
        .select({
          id: visitLog.id,
          ip: visitLog.ip,
          path: visitLog.path,
          isBot: visitLog.isBot,
          botKind: visitLog.botKind,
          userId: visitLog.userId,
          createdAt: visitLog.createdAt,
        })
        .from(visitLog)
        .where(
          and(
            before ? lt(visitLog.createdAt, before) : undefined,
            query.botsOnly === 'true' ? eq(visitLog.isBot, true) : undefined,
          ),
        )
        .orderBy(desc(visitLog.createdAt))
        .limit(PAGE);
      const nextCursor =
        rows.length === PAGE ? rows[rows.length - 1].createdAt.toISOString() : null;
      return { rows, nextCursor };
    },
    {
      query: t.Object({
        before: CursorSchema,
        botsOnly: t.Optional(t.String()),
      }),
    },
  )
  // Visit summary stats.
  .get('/visits/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(visitLog);
    const [bots] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visitLog)
      .where(eq(visitLog.isBot, true));
    return {
      total: Number(total?.count ?? 0),
      bots: Number(bots?.count ?? 0),
      humans: Number(total?.count ?? 0) - Number(bots?.count ?? 0),
    };
  })
  // Login log — newest first, keyset pagination.
  .get(
    '/login-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const before = query.before ? new Date(query.before) : undefined;
      const rows = await db
        .select({
          id: loginLog.id,
          userId: loginLog.userId,
          ip: loginLog.ip,
          userAgent: loginLog.userAgent,
          createdAt: loginLog.createdAt,
        })
        .from(loginLog)
        .where(before ? lt(loginLog.createdAt, before) : undefined)
        .orderBy(desc(loginLog.createdAt))
        .limit(PAGE);
      const nextCursor =
        rows.length === PAGE ? rows[rows.length - 1].createdAt.toISOString() : null;
      return { rows, nextCursor };
    },
    {
      query: t.Object({ before: CursorSchema }),
    },
  )
  // Rate-limit log — newest first.
  .get(
    '/rate-limit-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const before = query.before ? new Date(query.before) : undefined;
      const rows = await db
        .select({
          id: rateLimitLog.id,
          ip: rateLimitLog.ip,
          path: rateLimitLog.path,
          userId: rateLimitLog.userId,
          createdAt: rateLimitLog.createdAt,
        })
        .from(rateLimitLog)
        .where(before ? lt(rateLimitLog.createdAt, before) : undefined)
        .orderBy(desc(rateLimitLog.createdAt))
        .limit(PAGE);
      const nextCursor =
        rows.length === PAGE ? rows[rows.length - 1].createdAt.toISOString() : null;
      return { rows, nextCursor };
    },
    {
      query: t.Object({ before: CursorSchema }),
    },
  )
  // Purge old analytics rows (older than `days` days).
  .delete(
    '/purge',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const days = Math.min(Number(query.days ?? 30), 365);
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const [v, l, r] = await Promise.all([
        db.delete(visitLog).where(lt(visitLog.createdAt, cutoff)).returning({ id: visitLog.id }),
        db.delete(loginLog).where(lt(loginLog.createdAt, cutoff)).returning({ id: loginLog.id }),
        db
          .delete(rateLimitLog)
          .where(lt(rateLimitLog.createdAt, cutoff))
          .returning({ id: rateLimitLog.id }),
      ]);
      return { purgedVisits: v.length, purgedLogins: l.length, purgedRateLimits: r.length };
    },
    {
      query: t.Object({ days: t.Optional(t.String()) }),
    },
  );
