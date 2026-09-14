/** Cross-key usage log: filtered list + CSV export for /dev/api-keys → Log penggunaan. */
import { and, desc, eq, gte, ilike, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { apiKeyUsage, apikey, user } from '../db/schema';

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
export const USAGE_EXPORT_MAX_ROWS = 10_000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

export const UsageListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  keyId: t.Optional(t.String()),
  /** '2xx' | '4xx' | '5xx' | 'errors' */
  status: t.Optional(t.String()),
  method: t.Optional(t.String()),
  /** Substring match on path or IP. */
  search: t.Optional(t.String()),
  /** Look-back window in days (default 7, max 90). */
  days: t.Optional(t.String()),
});
export type UsageListQueryType = typeof UsageListQuery.static;

const usageSelect = {
  id: apiKeyUsage.id,
  keyId: apiKeyUsage.keyId,
  keyName: apikey.name,
  keyStart: apikey.start,
  ownerEmail: user.email,
  method: apiKeyUsage.method,
  path: apiKeyUsage.path,
  status: apiKeyUsage.status,
  ip: apiKeyUsage.ip,
  country: apiKeyUsage.country,
  userAgent: apiKeyUsage.userAgent,
  durationMs: apiKeyUsage.durationMs,
  createdAt: apiKeyUsage.createdAt,
};

function statusWhere(status: string | undefined): SQL | undefined {
  if (status === '2xx') return sql`${apiKeyUsage.status} between 200 and 299`;
  if (status === '4xx') return sql`${apiKeyUsage.status} between 400 and 499`;
  if (status === '5xx') return sql`${apiKeyUsage.status} >= 500`;
  if (status === 'errors') return sql`${apiKeyUsage.status} >= 400`;
  return undefined;
}

export function buildUsageWhere(q: UsageListQueryType): SQL | undefined {
  const days = Math.min(Math.max(1, Number(q.days ?? DEFAULT_DAYS) || DEFAULT_DAYS), MAX_DAYS);
  const search = q.search?.trim();
  return and(
    gte(apiKeyUsage.createdAt, new Date(Date.now() - days * 86_400_000)),
    q.keyId ? eq(apiKeyUsage.keyId, q.keyId) : undefined,
    q.method ? eq(apiKeyUsage.method, q.method.toUpperCase()) : undefined,
    statusWhere(q.status),
    search
      ? sql`(${ilike(apiKeyUsage.path, `%${search}%`)} or ${ilike(apiKeyUsage.ip, `%${search}%`)})`
      : undefined,
  );
}

function selectUsage() {
  return db
    .select(usageSelect)
    .from(apiKeyUsage)
    .leftJoin(apikey, eq(apiKeyUsage.keyId, apikey.id))
    .leftJoin(user, eq(apikey.referenceId, user.id));
}

export async function listUsage(q: UsageListQueryType) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildUsageWhere(q);
  const [rows, [totals]] = await Promise.all([
    selectUsage()
      .where(where)
      .orderBy(desc(apiKeyUsage.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(apiKeyUsage).where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}

export async function exportUsage(q: UsageListQueryType) {
  return selectUsage()
    .where(buildUsageWhere(q))
    .orderBy(desc(apiKeyUsage.createdAt))
    .limit(USAGE_EXPORT_MAX_ROWS);
}

const CSV_COLUMNS = [
  'createdAt',
  'keyName',
  'keyStart',
  'ownerEmail',
  'method',
  'path',
  'status',
  'durationMs',
  'ip',
  'country',
  'userAgent',
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with BOM (Excel detects UTF-8). */
export function usageToCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
