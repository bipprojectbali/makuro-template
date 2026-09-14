/** Filters + list/stats queries for the audit log console. */
import { and, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { auditLog, user } from '../db/schema';

export const AuditListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  action: t.Optional(t.String()),
  targetType: t.Optional(t.String()),
  actorId: t.Optional(t.String()),
  targetId: t.Optional(t.String()),
  days: t.Optional(t.String()),
});
export type AuditListQueryType = typeof AuditListQuery.static;

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_DAYS = 365;
const TOP_N = 5;
const count = sql<number>`count(*)::int`;

export function buildAuditWhere(q: AuditListQueryType): SQL | undefined {
  const search = q.search?.trim();
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  return and(
    q.action ? eq(auditLog.action, q.action) : undefined,
    q.targetType ? eq(auditLog.targetType, q.targetType) : undefined,
    q.actorId ? eq(auditLog.actorId, q.actorId) : undefined,
    q.targetId ? eq(auditLog.targetId, q.targetId) : undefined,
    days > 0 ? gte(auditLog.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
    search
      ? or(
          ilike(auditLog.summary, `%${search}%`),
          ilike(auditLog.action, `%${search}%`),
          ilike(auditLog.actorEmail, `%${search}%`),
          ilike(auditLog.targetId, `%${search}%`),
          ilike(auditLog.ip, `%${search}%`),
          ilike(user.name, `%${search}%`),
        )
      : undefined,
  );
}

export const auditSelect = {
  id: auditLog.id,
  actorId: auditLog.actorId,
  actorEmail: auditLog.actorEmail,
  actorName: user.name,
  actorImage: user.image,
  action: auditLog.action,
  targetType: auditLog.targetType,
  targetId: auditLog.targetId,
  summary: auditLog.summary,
  meta: auditLog.meta,
  ip: auditLog.ip,
  userAgent: auditLog.userAgent,
  createdAt: auditLog.createdAt,
};

export async function listAudit(q: AuditListQueryType) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildAuditWhere(q);
  const [rows, [totals]] = await Promise.all([
    db
      .select(auditSelect)
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorId, user.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count }).from(auditLog).leftJoin(user, eq(auditLog.actorId, user.id)).where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}

export async function auditStats() {
  const [[totals], actions, actors, targets] = await Promise.all([
    db
      .select({
        total: count,
        last24h: sql<number>`count(*) filter (where ${auditLog.createdAt} >= now() - interval '24 hours')::int`,
        last7d: sql<number>`count(*) filter (where ${auditLog.createdAt} >= now() - interval '7 days')::int`,
        destructive: sql<number>`count(*) filter (where ${auditLog.action} in ('user.delete','logs.purge','logs.delete'))::int`,
      })
      .from(auditLog),
    db
      .select({ key: auditLog.action, count })
      .from(auditLog)
      .groupBy(auditLog.action)
      .orderBy(desc(sql`count(*)`))
      .limit(TOP_N),
    db
      .select({
        actorId: auditLog.actorId,
        email: auditLog.actorEmail,
        name: user.name,
        image: user.image,
        count,
      })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorId, user.id))
      .groupBy(auditLog.actorId, auditLog.actorEmail, user.name, user.image)
      .orderBy(desc(sql`count(*)`))
      .limit(TOP_N),
    db
      .select({ key: auditLog.targetType, count })
      .from(auditLog)
      .groupBy(auditLog.targetType)
      .orderBy(desc(sql`count(*)`))
      .limit(TOP_N),
  ]);
  return {
    total: totals?.total ?? 0,
    last24h: totals?.last24h ?? 0,
    last7d: totals?.last7d ?? 0,
    destructive: totals?.destructive ?? 0,
    topActions: actions,
    topActors: actors,
    targets,
  };
}

const CSV_COLUMNS: Array<keyof typeof auditSelect> = [
  'createdAt',
  'actorEmail',
  'actorName',
  'action',
  'targetType',
  'targetId',
  'summary',
  'ip',
  'meta',
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s =
    v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toAuditCsv(rows: Array<Record<string, unknown>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
