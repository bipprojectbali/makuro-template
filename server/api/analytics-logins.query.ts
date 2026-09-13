/** Filter parsing + WHERE builder shared by the login-log list, count, and CSV export. */
import { and, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { loginLog, user } from '../db/schema';
import { pageParams } from './analytics-paging';

export const LoginListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  search: t.Optional(t.String()),
  country: t.Optional(t.String()),
  device: t.Optional(t.String()),
  /** 'email' | 'google' | 'impersonation' | 'switch' | … */
  method: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  /** Only rows from the last N days (1–365). */
  days: t.Optional(t.String()),
});

export type LoginListQueryType = typeof LoginListQuery.static;

const MAX_DAYS = 365;

export function buildLoginWhere(q: LoginListQueryType): SQL | undefined {
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  const search = q.search?.trim();
  return and(
    q.country ? eq(loginLog.country, q.country.toUpperCase()) : undefined,
    q.device ? eq(loginLog.deviceType, q.device) : undefined,
    q.method ? eq(loginLog.method, q.method) : undefined,
    q.userId ? eq(loginLog.userId, q.userId) : undefined,
    days > 0 ? gte(loginLog.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
    search
      ? or(
          ilike(loginLog.userId, `%${search}%`),
          ilike(loginLog.ip, `%${search}%`),
          ilike(loginLog.city, `%${search}%`),
          ilike(loginLog.country, `%${search}%`),
          ilike(loginLog.browser, `%${search}%`),
          ilike(loginLog.os, `%${search}%`),
          ilike(loginLog.method, `%${search}%`),
          ilike(loginLog.userAgent, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
        )
      : undefined,
  );
}

export const loginSelect = {
  id: loginLog.id,
  userId: loginLog.userId,
  userName: user.name,
  userEmail: user.email,
  userImage: user.image,
  userRole: user.role,
  ip: loginLog.ip,
  userAgent: loginLog.userAgent,
  method: loginLog.method,
  country: loginLog.country,
  region: loginLog.region,
  city: loginLog.city,
  browser: loginLog.browser,
  browserVersion: loginLog.browserVersion,
  os: loginLog.os,
  osVersion: loginLog.osVersion,
  deviceType: loginLog.deviceType,
  language: loginLog.language,
  createdAt: loginLog.createdAt,
};

const CSV_COLUMNS: Array<keyof typeof loginSelect> = [
  'createdAt',
  'userId',
  'userName',
  'userEmail',
  'method',
  'ip',
  'country',
  'region',
  'city',
  'deviceType',
  'browser',
  'browserVersion',
  'os',
  'osVersion',
  'language',
  'userAgent',
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with BOM (Excel-friendly). */
export function toLoginCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

const count = sql<number>`count(*)::int`;

/** One page of rows + total for the given filters (shared by the API and SSR loaders). */
export async function listLogins(query: LoginListQueryType) {
  const { page, limit, offset, order } = pageParams(query);
  const where = buildLoginWhere(query);
  const [rows, [totals]] = await Promise.all([
    db
      .select(loginSelect)
      .from(loginLog)
      .leftJoin(user, eq(loginLog.userId, user.id))
      .where(where)
      .orderBy(order(loginLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count }).from(loginLog).leftJoin(user, eq(loginLog.userId, user.id)).where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}
