/**
 * Analytics read/write endpoints for the super-admin /dev console.
 * All endpoints are protected by requireRole(SUPER_ADMIN).
 */
import { and, asc, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { loginLog, rateLimitLog, user, visitLog } from '../db/schema';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';

const PAGE_SIZE = 25;

const ListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  /** 'asc' | 'desc' — default desc (newest first) */
  sort: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export function pageParams(query: { page?: string; limit?: string; sort?: string }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(Number(query.limit ?? PAGE_SIZE), 100);
  const order = query.sort === 'asc' ? asc : desc;
  return { page, limit, offset: (page - 1) * limit, order };
}

export const analyticsApi = new Elysia({ prefix: '/analytics' })
  // ── Visits ────────────────────────────────────────────────────────────────

  .get(
    '/visits',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const { page, limit, offset, order } = pageParams(query);

      const where = and(
        query.botsOnly === 'true' ? eq(visitLog.isBot, true) : undefined,
        query.search
          ? or(
              ilike(visitLog.ip, `%${query.search}%`),
              ilike(visitLog.path, `%${query.search}%`),
            )
          : undefined,
      );

      const [rows, [totals]] = await Promise.all([
        db
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
          .where(where)
          .orderBy(order(visitLog.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(visitLog).where(where),
      ]);

      return { rows, total: totals?.count ?? 0, page, limit };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        search: t.Optional(t.String()),
        botsOnly: t.Optional(t.String()),
      }),
    },
  )

  .delete('/visits/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(visitLog)
      .where(eq(visitLog.id, params.id))
      .returning({ id: visitLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  })

  .get('/visits/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [[all], [bots]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(visitLog),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitLog)
        .where(eq(visitLog.isBot, true)),
    ]);
    const total = all?.count ?? 0;
    const botCount = bots?.count ?? 0;
    return { total, bots: botCount, humans: total - botCount };
  })

  // ── Login logs ────────────────────────────────────────────────────────────

  .get(
    '/login-logs',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const { page, limit, offset, order } = pageParams(query);

      const where = query.search
        ? or(
            ilike(loginLog.userId, `%${query.search}%`),
            ilike(loginLog.ip, `%${query.search}%`),
            ilike(user.name, `%${query.search}%`),
          )
        : undefined;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: loginLog.id,
            userId: loginLog.userId,
            userName: user.name,
            userImage: user.image,
            ip: loginLog.ip,
            userAgent: loginLog.userAgent,
            createdAt: loginLog.createdAt,
          })
          .from(loginLog)
          .leftJoin(user, eq(loginLog.userId, user.id))
          .where(where)
          .orderBy(order(loginLog.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(loginLog)
          .leftJoin(user, eq(loginLog.userId, user.id))
          .where(where),
      ]);

      return { rows, total: totals?.count ?? 0, page, limit };
    },
    { query: ListQuery },
  )

  .delete('/login-logs/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    const [d] = await db
      .delete(loginLog)
      .where(eq(loginLog.id, params.id))
      .returning({ id: loginLog.id });
    if (!d) return status(404, { error: 'Not found' });
    return { ok: true };
  })

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
