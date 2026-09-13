/** Cross-user session queries for the admin console. */
import { and, desc, eq, gt, ilike, isNotNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { session, user } from '../db/schema';

export const SessionListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  /** 'active' (default) | 'expired' | 'all' */
  status: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  impersonated: t.Optional(t.String()),
});
export type SessionListQueryType = typeof SessionListQuery.static;

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SOON_HOURS = 24;
const count = sql<number>`count(*)::int`;

export function buildSessionWhere(q: SessionListQueryType): SQL | undefined {
  const search = q.search?.trim();
  const status = q.status ?? 'active';
  return and(
    status === 'active'
      ? gt(session.expiresAt, sql`now()`)
      : status === 'expired'
        ? lte(session.expiresAt, sql`now()`)
        : undefined,
    q.userId ? eq(session.userId, q.userId) : undefined,
    q.impersonated === 'true' ? isNotNull(session.impersonatedBy) : undefined,
    search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(session.ipAddress, `%${search}%`),
          ilike(session.userAgent, `%${search}%`),
          ilike(session.userId, `%${search}%`),
        )
      : undefined,
  );
}

/** Token is never selected — revocation is by row id. */
export const sessionSelect = {
  id: session.id,
  userId: session.userId,
  userName: user.name,
  userEmail: user.email,
  userImage: user.image,
  userRole: user.role,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  impersonatedBy: session.impersonatedBy,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  expiresAt: session.expiresAt,
};

export async function listSessions(q: SessionListQueryType) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildSessionWhere(q);
  const [rows, [totals]] = await Promise.all([
    db
      .select(sessionSelect)
      .from(session)
      .leftJoin(user, eq(session.userId, user.id))
      .where(where)
      .orderBy(desc(session.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count }).from(session).leftJoin(user, eq(session.userId, user.id)).where(where),
  ]);
  return { rows, total: totals?.count ?? 0, page, limit };
}

export async function sessionStats() {
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${session.expiresAt} > now())::int`,
      expired: sql<number>`count(*) filter (where ${session.expiresAt} <= now())::int`,
      users: sql<number>`count(distinct ${session.userId}) filter (where ${session.expiresAt} > now())::int`,
      impersonated: sql<number>`count(*) filter (where ${session.expiresAt} > now() and ${session.impersonatedBy} is not null)::int`,
      expiringSoon: sql<number>`count(*) filter (where ${session.expiresAt} > now() and ${session.expiresAt} <= now() + interval '${sql.raw(String(SOON_HOURS))} hours')::int`,
      activeLastHour: sql<number>`count(*) filter (where ${session.expiresAt} > now() and ${session.updatedAt} >= now() - interval '1 hour')::int`,
    })
    .from(session);
  return { ...row, soonHours: SOON_HOURS };
}

/** Delete one session row; returns the owner id or null when missing. */
export async function revokeSessionById(id: string): Promise<{ userId: string } | null> {
  const [d] = await db
    .delete(session)
    .where(eq(session.id, id))
    .returning({ userId: session.userId });
  return d ?? null;
}

/** Delete every session of a user (optionally keeping one row). Returns count. */
export async function revokeUserSessions(userId: string, keepId?: string): Promise<number> {
  const rows = await db
    .delete(session)
    .where(and(eq(session.userId, userId), keepId ? sql`${session.id} <> ${keepId}` : undefined))
    .returning({ id: session.id });
  return rows.length;
}
