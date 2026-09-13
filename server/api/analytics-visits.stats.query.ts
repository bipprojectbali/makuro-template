/** Aggregate queries behind GET /analytics/visits/stats. */
import { type ColumnBaseConfig, desc, isNotNull, type SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db';
import { visitLog } from '../db/schema';
import { env } from '../env';

const TOP_N = 5;
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

/** Totals plus top-N breakdowns for the visitor console KPI/breakdown panels. */
export async function getVisitStats() {
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
}
