/**
 * Visitor log endpoints for the super-admin console (/dev/visits).
 * Mounted under /analytics by analytics.ts. All routes require SUPER_ADMIN.
 */
import { type ColumnBaseConfig, desc, eq, inArray, isNotNull, type SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { user, visitLog } from '../db/schema';
import { env } from '../env';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import { pageParams } from './analytics-paging';
import { buildVisitWhere, toCsv, VisitListQuery, visitSelect } from './analytics-visits.query';

/** Hard cap for CSV export — keeps memory bounded on large tables. */
export const EXPORT_MAX_ROWS = 10_000;
const TOP_N = 5;
const BULK_DELETE_MAX = 100;
const count = sql<number>`count(*)::int`;

type VisitTextColumn = PgColumn<ColumnBaseConfig<'string', string>>;

/** Top-N breakdown of a nullable text column (null values excluded unless `where` is given). */
function topBy(column: VisitTextColumn, where: SQL = isNotNull(column)) {
  return db
    .select({ key: column, count })
    .from(visitLog)
    .where(where)
    .groupBy(column)
    .orderBy(desc(sql`count(*)`))
    .limit(TOP_N);
}

export const visitsApi = new Elysia()
  .get(
    '/visits',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const { page, limit, offset, order } = pageParams(query);
      const where = buildVisitWhere(query);

      const [rows, [totals]] = await Promise.all([
        db
          .select(visitSelect)
          .from(visitLog)
          .leftJoin(user, eq(visitLog.userId, user.id))
          .where(where)
          .orderBy(order(visitLog.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count })
          .from(visitLog)
          .leftJoin(user, eq(visitLog.userId, user.id))
          .where(where),
      ]);

      return { rows, total: totals?.count ?? 0, page, limit };
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
    const appOrigin = new URL(env.APP_URL).origin;
    const [[totals], countries, browsers, oses, devices, paths, referers] = await Promise.all([
      db
        .select({
          total: count,
          bots: sql<number>`count(*) filter (where ${visitLog.isBot})::int`,
          uniqueIps: sql<number>`count(distinct ${visitLog.ip})::int`,
          last24h: sql<number>`count(*) filter (where ${visitLog.createdAt} >= now() - interval '24 hours')::int`,
          last7d: sql<number>`count(*) filter (where ${visitLog.createdAt} >= now() - interval '7 days')::int`,
          loggedIn: sql<number>`count(*) filter (where ${visitLog.userId} is not null)::int`,
        })
        .from(visitLog),
      topBy(visitLog.country),
      topBy(visitLog.browser),
      topBy(visitLog.os),
      topBy(visitLog.deviceType),
      topBy(visitLog.path, sql`true`),
      // External referers only — internal navigation would dominate otherwise.
      topBy(
        visitLog.referer,
        sql`${visitLog.referer} is not null and ${visitLog.referer} not like ${`${appOrigin}%`}`,
      ),
    ]);

    const total = totals?.total ?? 0;
    const bots = totals?.bots ?? 0;
    return {
      total,
      bots,
      humans: total - bots,
      uniqueIps: totals?.uniqueIps ?? 0,
      last24h: totals?.last24h ?? 0,
      last7d: totals?.last7d ?? 0,
      loggedIn: totals?.loggedIn ?? 0,
      topCountries: countries,
      topBrowsers: browsers,
      topOs: oses,
      devices,
      topPaths: paths,
      topReferers: referers,
    };
  })

  .delete(
    '/visits',
    async ({ request, body }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      const deleted = await db
        .delete(visitLog)
        .where(inArray(visitLog.id, body.ids))
        .returning({ id: visitLog.id });
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
