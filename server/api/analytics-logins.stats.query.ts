/** Aggregate queries behind GET /analytics/login-logs/stats. */
import { type ColumnBaseConfig, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db';
import { loginLog, user } from '../db/schema';

const TOP_N = 5;
const count = sql<number>`count(*)::int`;

type TextColumn = PgColumn<ColumnBaseConfig<'string', string>>;

function topBy(column: TextColumn) {
  return db
    .select({ key: column, count })
    .from(loginLog)
    .where(isNotNull(column))
    .groupBy(column)
    .orderBy(desc(sql`count(*)`))
    .limit(TOP_N);
}

/** Totals plus top-N breakdowns for the login console. */
export async function getLoginStats() {
  const [[totals], users, countries, methods, devices, browsers, oses] = await Promise.all([
    db
      .select({
        total: count,
        uniqueUsers: sql<number>`count(distinct ${loginLog.userId})::int`,
        uniqueIps: sql<number>`count(distinct ${loginLog.ip})::int`,
        last24h: sql<number>`count(*) filter (where ${loginLog.createdAt} >= now() - interval '24 hours')::int`,
        last7d: sql<number>`count(*) filter (where ${loginLog.createdAt} >= now() - interval '7 days')::int`,
        impersonations: sql<number>`count(*) filter (where ${loginLog.method} = 'impersonation')::int`,
      })
      .from(loginLog),
    db
      .select({ userId: loginLog.userId, name: user.name, image: user.image, count })
      .from(loginLog)
      .leftJoin(user, eq(loginLog.userId, user.id))
      .groupBy(loginLog.userId, user.name, user.image)
      .orderBy(desc(sql`count(*)`))
      .limit(TOP_N),
    topBy(loginLog.country),
    topBy(loginLog.method),
    topBy(loginLog.deviceType),
    topBy(loginLog.browser),
    topBy(loginLog.os),
  ]);

  return {
    total: totals?.total ?? 0,
    uniqueUsers: totals?.uniqueUsers ?? 0,
    uniqueIps: totals?.uniqueIps ?? 0,
    last24h: totals?.last24h ?? 0,
    last7d: totals?.last7d ?? 0,
    impersonations: totals?.impersonations ?? 0,
    topUsers: users,
    topCountries: countries,
    topMethods: methods,
    devices,
    topBrowsers: browsers,
    topOs: oses,
  };
}
