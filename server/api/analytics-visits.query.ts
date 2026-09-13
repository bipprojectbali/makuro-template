/** Filter parsing + WHERE builder shared by the visit list, count, and CSV export. */
import { and, eq, gte, ilike, or, type SQL } from 'drizzle-orm';
import { t } from 'elysia';
import { user, visitLog } from '../db/schema';

export const VisitListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  search: t.Optional(t.String()),
  /** Legacy flag — same as type=bot. */
  botsOnly: t.Optional(t.String()),
  /** 'human' | 'bot' — omit for all. */
  type: t.Optional(t.String()),
  /** ISO 3166-1 alpha-2, case-insensitive. */
  country: t.Optional(t.String()),
  /** 'desktop' | 'mobile' | 'tablet' | 'bot' */
  device: t.Optional(t.String()),
  browser: t.Optional(t.String()),
  os: t.Optional(t.String()),
  /** Only rows from the last N days (1–365). */
  days: t.Optional(t.String()),
});

export type VisitListQueryType = typeof VisitListQuery.static;

const MAX_DAYS = 365;

/** Build the WHERE clause for visit queries. Returns undefined when unfiltered. */
export function buildVisitWhere(q: VisitListQueryType): SQL | undefined {
  const type = q.botsOnly === 'true' ? 'bot' : q.type;
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  const search = q.search?.trim();

  return and(
    type === 'bot' ? eq(visitLog.isBot, true) : undefined,
    type === 'human' ? eq(visitLog.isBot, false) : undefined,
    q.country ? eq(visitLog.country, q.country.toUpperCase()) : undefined,
    q.device ? eq(visitLog.deviceType, q.device) : undefined,
    q.browser ? eq(visitLog.browser, q.browser) : undefined,
    q.os ? eq(visitLog.os, q.os) : undefined,
    days > 0 ? gte(visitLog.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
    search
      ? or(
          ilike(visitLog.ip, `%${search}%`),
          ilike(visitLog.path, `%${search}%`),
          ilike(visitLog.referer, `%${search}%`),
          ilike(visitLog.city, `%${search}%`),
          ilike(visitLog.country, `%${search}%`),
          ilike(visitLog.browser, `%${search}%`),
          ilike(visitLog.os, `%${search}%`),
          ilike(visitLog.userAgent, `%${search}%`),
          ilike(user.name, `%${search}%`),
        )
      : undefined,
  );
}

/** Columns returned by list + export (joined with the user table). */
export const visitSelect = {
  id: visitLog.id,
  ip: visitLog.ip,
  path: visitLog.path,
  referer: visitLog.referer,
  userAgent: visitLog.userAgent,
  isBot: visitLog.isBot,
  botKind: visitLog.botKind,
  country: visitLog.country,
  region: visitLog.region,
  city: visitLog.city,
  browser: visitLog.browser,
  browserVersion: visitLog.browserVersion,
  os: visitLog.os,
  osVersion: visitLog.osVersion,
  deviceType: visitLog.deviceType,
  language: visitLog.language,
  userId: visitLog.userId,
  userName: user.name,
  userImage: user.image,
  createdAt: visitLog.createdAt,
};

export type VisitSelectRow = {
  [K in keyof typeof visitSelect]: (typeof visitSelect)[K]['_']['data'] | null;
};

const CSV_COLUMNS: Array<keyof typeof visitSelect> = [
  'createdAt',
  'ip',
  'country',
  'region',
  'city',
  'path',
  'referer',
  'isBot',
  'botKind',
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

/** Serialize rows to RFC 4180 CSV (with BOM so Excel detects UTF-8). */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
