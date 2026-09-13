/** Filter parsing + WHERE builder shared by the rate-limit list, count, and CSV export. */
import { and, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { rateLimitLog, user } from '../db/schema';
import { pageParams } from './analytics-paging';

export const RateLimitListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  search: t.Optional(t.String()),
  ip: t.Optional(t.String()),
  path: t.Optional(t.String()),
  country: t.Optional(t.String()),
  device: t.Optional(t.String()),
  method: t.Optional(t.String()),
  /** Only rows from the last N days (1–365). */
  days: t.Optional(t.String()),
});

export type RateLimitListQueryType = typeof RateLimitListQuery.static;

const MAX_DAYS = 365;

export function buildRateLimitWhere(q: RateLimitListQueryType): SQL | undefined {
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  const search = q.search?.trim();
  return and(
    q.ip ? eq(rateLimitLog.ip, q.ip) : undefined,
    q.path ? eq(rateLimitLog.path, q.path) : undefined,
    q.country ? eq(rateLimitLog.country, q.country.toUpperCase()) : undefined,
    q.device ? eq(rateLimitLog.deviceType, q.device) : undefined,
    q.method ? eq(rateLimitLog.method, q.method.toUpperCase()) : undefined,
    days > 0 ? gte(rateLimitLog.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
    search
      ? or(
          ilike(rateLimitLog.ip, `%${search}%`),
          ilike(rateLimitLog.path, `%${search}%`),
          ilike(rateLimitLog.city, `%${search}%`),
          ilike(rateLimitLog.country, `%${search}%`),
          ilike(rateLimitLog.browser, `%${search}%`),
          ilike(rateLimitLog.os, `%${search}%`),
          ilike(rateLimitLog.userAgent, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
        )
      : undefined,
  );
}

export const rateLimitSelect = {
  id: rateLimitLog.id,
  ip: rateLimitLog.ip,
  path: rateLimitLog.path,
  method: rateLimitLog.method,
  userAgent: rateLimitLog.userAgent,
  country: rateLimitLog.country,
  region: rateLimitLog.region,
  city: rateLimitLog.city,
  browser: rateLimitLog.browser,
  browserVersion: rateLimitLog.browserVersion,
  os: rateLimitLog.os,
  osVersion: rateLimitLog.osVersion,
  deviceType: rateLimitLog.deviceType,
  language: rateLimitLog.language,
  userId: rateLimitLog.userId,
  userName: user.name,
  userImage: user.image,
  createdAt: rateLimitLog.createdAt,
};

const CSV_COLUMNS: Array<keyof typeof rateLimitSelect> = [
  'createdAt',
  'ip',
  'method',
  'path',
  'country',
  'region',
  'city',
  'deviceType',
  'browser',
  'browserVersion',
  'os',
  'osVersion',
  'language',
  'userId',
  'userName',
  'userAgent',
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with BOM (Excel-friendly). */
export function toRateLimitCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

const count = sql<number>`count(*)::int`;

/** One page of rows + total for the given filters (shared by the API and SSR loaders). */
export async function listRateLimits(query: RateLimitListQueryType) {
  const { page, limit, offset, order } = pageParams(query);
  const where = buildRateLimitWhere(query);
  const [rows, [totals]] = await Promise.all([
    db
      .select(rateLimitSelect)
      .from(rateLimitLog)
      .leftJoin(user, eq(rateLimitLog.userId, user.id))
      .where(where)
      .orderBy(order(rateLimitLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count })
      .from(rateLimitLog)
      .leftJoin(user, eq(rateLimitLog.userId, user.id))
      .where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}
