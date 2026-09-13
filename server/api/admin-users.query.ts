/** User directory queries for the admin console (list with filters + stats). */
import { and, asc, desc, eq, gte, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';
import { t } from 'elysia';
import { db } from '../db';
import { loginLog, user } from '../db/schema';
import { ROLES } from '../permissions';

export const UserListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  /** 'user' | 'admin' | 'super-admin' */
  role: t.Optional(t.String()),
  /** 'active' | 'banned' */
  status: t.Optional(t.String()),
  /** Joined within the last N days (1–365). */
  days: t.Optional(t.String()),
  /** 'newest' (default) | 'oldest' | 'name' | 'lastLogin' */
  sort: t.Optional(t.String()),
});
export type UserListQueryType = typeof UserListQuery.static;

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_DAYS = 365;

// Correlated subqueries must qualify columns explicitly: drizzle renders bare
// column names inside `sql` fragments, so `user_id = "id"` would compare the
// inner table with itself.
const lastLoginAt = sql<
  string | null
>`(select max(l.created_at) from login_log l where l.user_id = "user".id)`;
const loginCount = sql<number>`(select count(*)::int from login_log l where l.user_id = "user".id)`;
const activeSessions = sql<number>`(select count(*)::int from session s where s.user_id = "user".id and s.expires_at > now())`;
const providers = sql<
  string[]
>`coalesce((select array_agg(distinct a.provider_id) from account a where a.user_id = "user".id), '{}')`;

export function buildUserWhere(q: UserListQueryType): SQL | undefined {
  const search = q.search?.trim();
  const days = q.days ? Math.min(Math.max(0, Number(q.days) || 0), MAX_DAYS) : 0;
  return and(
    search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(user.id, `%${search}%`),
        )
      : undefined,
    q.role === ROLES.USER
      ? or(eq(user.role, ROLES.USER), isNull(user.role))
      : q.role
        ? eq(user.role, q.role)
        : undefined,
    q.status === 'banned'
      ? eq(user.banned, true)
      : q.status === 'active'
        ? or(eq(user.banned, false), isNull(user.banned))
        : undefined,
    days > 0 ? gte(user.createdAt, new Date(Date.now() - days * 86_400_000)) : undefined,
  );
}

function orderFor(sort: string | undefined) {
  switch (sort) {
    case 'oldest':
      return [asc(user.createdAt)];
    case 'name':
      return [asc(user.name)];
    case 'lastLogin':
      return [sql`${lastLoginAt} desc nulls last`];
    default:
      return [desc(user.createdAt)];
  }
}

/** One page of users with login/session/provider enrichment. */
export async function listAdminUsers(q: UserListQueryType) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildUserWhere(q);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
        lastLoginAt,
        loginCount,
        activeSessions,
        providers,
      })
      .from(user)
      .where(where)
      .orderBy(...orderFor(q.sort))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(user).where(where),
  ]);
  return { users: rows, total: totals?.count ?? 0, page, limit };
}

/** Headline numbers for the users console and the /dev overview. */
export async function adminUserStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      admins: sql<number>`count(*) filter (where ${user.role} = ${ROLES.ADMIN})::int`,
      superAdmins: sql<number>`count(*) filter (where ${user.role} = ${ROLES.SUPER_ADMIN})::int`,
      banned: sql<number>`count(*) filter (where ${user.banned} = true)::int`,
      verified: sql<number>`count(*) filter (where ${user.emailVerified} = true)::int`,
      new7d: sql<number>`count(*) filter (where ${user.createdAt} >= now() - interval '7 days')::int`,
    })
    .from(user);
  const [active] = await db
    .select({ count: sql<number>`count(distinct ${loginLog.userId})::int` })
    .from(loginLog)
    .where(sql`${loginLog.createdAt} >= now() - interval '24 hours'`);
  return { ...row, active24h: active?.count ?? 0 };
}
