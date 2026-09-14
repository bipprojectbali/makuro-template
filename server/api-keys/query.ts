/** API key read side: list/get/stats rows shared by the management API, sidebar badge and services. */
import { and, desc, eq, gt, ilike, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { db } from '../db';
import { apiKeyUsage, apikey, user } from '../db/schema';
import { SCOPE_IDS, type Scope } from './scopes';

export const EXPIRING_SOON_DAYS = 7;
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const count = sql<number>`count(*)::int`;

export function parseScopes(permissions: string | null): Scope[] {
  try {
    const parsed = permissions ? (JSON.parse(permissions) as { scope?: string[] }) : null;
    return (parsed?.scope ?? []).filter((s): s is Scope => SCOPE_IDS.includes(s));
  } catch {
    return [];
  }
}

export const keySelect = {
  id: apikey.id,
  name: apikey.name,
  start: apikey.start,
  prefix: apikey.prefix,
  ownerId: apikey.referenceId,
  ownerName: user.name,
  ownerEmail: user.email,
  ownerImage: user.image,
  ownerRole: user.role,
  enabled: apikey.enabled,
  rateLimitEnabled: apikey.rateLimitEnabled,
  rateLimitTimeWindow: apikey.rateLimitTimeWindow,
  rateLimitMax: apikey.rateLimitMax,
  lastRequest: apikey.lastRequest,
  expiresAt: apikey.expiresAt,
  createdAt: apikey.createdAt,
  updatedAt: apikey.updatedAt,
  permissions: apikey.permissions,
  rotatedFromId: apikey.rotatedFromId,
  allowedIps: apikey.allowedIps,
  note: apikey.note,
  lastIp: apikey.lastIp,
  lastCountry: apikey.lastCountry,
  revokedAt: apikey.revokedAt,
  usage24h: sql<number>`(select count(*)::int from ${apiKeyUsage} u where u.key_id = ${apikey.id} and u.created_at >= now() - interval '24 hours')`,
};

function selectKeys() {
  return db.select(keySelect).from(apikey).leftJoin(user, eq(apikey.referenceId, user.id));
}
type RawKey = Awaited<ReturnType<ReturnType<typeof selectKeys>['execute']>>[number];
export type KeyRow = Omit<RawKey, 'permissions'> & { scopes: Scope[]; status: KeyStatus };
export type KeyStatus = 'active' | 'disabled' | 'expired' | 'revoked' | 'rotating';

export function keyStatus(
  k: {
    enabled: boolean | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    rotatedFromId?: string | null;
  },
  now = Date.now(),
  rotatedTo = false,
): KeyStatus {
  if (k.revokedAt) return 'revoked';
  if (k.enabled === false) return 'disabled';
  if (k.expiresAt && k.expiresAt.getTime() <= now) return 'expired';
  if (rotatedTo) return 'rotating';
  return 'active';
}

export type KeyListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  ownerId?: string;
  scope?: string;
};

function buildWhere(q: KeyListQuery): SQL | undefined {
  const search = q.search?.trim();
  const now = sql`now()`;
  return and(
    q.ownerId ? eq(apikey.referenceId, q.ownerId) : undefined,
    q.scope ? ilike(apikey.permissions, `%"${q.scope}"%`) : undefined,
    q.status === 'active'
      ? and(
          isNull(apikey.revokedAt),
          eq(apikey.enabled, true),
          or(isNull(apikey.expiresAt), gt(apikey.expiresAt, now)),
        )
      : undefined,
    q.status === 'disabled' ? and(isNull(apikey.revokedAt), eq(apikey.enabled, false)) : undefined,
    q.status === 'expired' ? and(isNull(apikey.revokedAt), lte(apikey.expiresAt, now)) : undefined,
    q.status === 'revoked' ? sql`${apikey.revokedAt} is not null` : undefined,
    search
      ? or(
          ilike(apikey.name, `%${search}%`),
          ilike(apikey.start, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(apikey.note, `%${search}%`),
        )
      : undefined,
  );
}

function toRow(r: RawKey, rotatedIds: Set<string>): KeyRow {
  const { permissions, ...rest } = r;
  return {
    ...rest,
    scopes: parseScopes(permissions),
    status: keyStatus(r, Date.now(), rotatedIds.has(r.id)),
  };
}

export async function listKeys(q: KeyListQuery) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(q.limit ?? PAGE_SIZE) || PAGE_SIZE), MAX_PAGE_SIZE);
  const where = buildWhere(q);
  const [rows, [totals], rotated] = await Promise.all([
    selectKeys()
      .where(where)
      .orderBy(desc(apikey.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count }).from(apikey).leftJoin(user, eq(apikey.referenceId, user.id)).where(where),
    db
      .select({ id: apikey.rotatedFromId })
      .from(apikey)
      .where(sql`${apikey.rotatedFromId} is not null`),
  ]);
  const rotatedIds = new Set(rotated.map((r) => r.id).filter((x): x is string => Boolean(x)));
  return { rows: rows.map((r) => toRow(r, rotatedIds)), total: totals?.count ?? 0, page, limit };
}

export async function getKey(id: string): Promise<KeyRow | null> {
  const [row] = await selectKeys().where(eq(apikey.id, id)).limit(1);
  if (!row) return null;
  const [succ] = await db
    .select({ id: apikey.id })
    .from(apikey)
    .where(eq(apikey.rotatedFromId, id))
    .limit(1);
  return toRow(row, new Set(succ ? [id] : []));
}

export async function keyStats() {
  const [row] = await db
    .select({
      total: count,
      active: sql<number>`count(*) filter (where ${apikey.revokedAt} is null and ${apikey.enabled} = true and (${apikey.expiresAt} is null or ${apikey.expiresAt} > now()))::int`,
      expiringSoon: sql<number>`count(*) filter (where ${apikey.revokedAt} is null and ${apikey.enabled} = true and ${apikey.expiresAt} > now() and ${apikey.expiresAt} <= now() + interval '${sql.raw(String(EXPIRING_SOON_DAYS))} days')::int`,
      revoked: sql<number>`count(*) filter (where ${apikey.revokedAt} is not null)::int`,
      owners: sql<number>`count(distinct ${apikey.referenceId})::int`,
    })
    .from(apikey);
  const [usage] = await db
    .select({
      last24h: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= now() - interval '24 hours')::int`,
      errors24h: sql<number>`count(*) filter (where ${apiKeyUsage.createdAt} >= now() - interval '24 hours' and ${apiKeyUsage.status} >= 400)::int`,
    })
    .from(apiKeyUsage);
  return {
    ...row,
    usage24h: usage?.last24h ?? 0,
    errors24h: usage?.errors24h ?? 0,
    expiringSoonDays: EXPIRING_SOON_DAYS,
  };
}

/** Create via the plugin (hashing, prefix), then store our extra columns. Returns the plain key exactly once. */
// Server-side plugin calls must not carry request headers: with headers the
// plugin treats the call as a client request and rejects server-only fields.
/** Keys expiring within EXPIRING_SOON_DAYS — sidebar badge. */
export async function countExpiringSoon(): Promise<number> {
  return (await keyStats()).expiringSoon;
}
