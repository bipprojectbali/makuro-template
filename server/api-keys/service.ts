/** API key write side: create (reveal once), update, rotate, revoke, delete — on top of the Better Auth plugin. */
import { eq } from 'drizzle-orm';
import { auth } from '../auth';
import { db } from '../db';
import { apikey, user } from '../db/schema';
import { normalizeRole, type Role } from '../permissions';
import { joinLines, parseLines } from '../settings.core';
import { getKey, type KeyRow } from './query';
import { roleAllowsScope, type Scope } from './scopes';

export const ROTATION_GRACE_MS = 24 * 3_600_000;

export type KeyInput = {
  name: string;
  ownerId: string;
  scopes: Scope[];
  /** Days until expiry; null = never (super-admin only, enforced by the API). */
  expiresDays: number | null;
  rateLimitMax: number | null;
  rateLimitWindowMs: number | null;
  allowedIps: string[] | null;
  note: string | null;
};

/** Drop scopes the owner's role cannot grant. */
export async function clampScopes(
  ownerId: string,
  scopes: Scope[],
): Promise<{ scopes: Scope[]; role: Role } | null> {
  const [owner] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, ownerId))
    .limit(1);
  if (!owner) return null;
  const role = normalizeRole(owner.role);
  return { role, scopes: scopes.filter((s) => roleAllowsScope(role, s)) };
}

export async function createKey(input: KeyInput): Promise<{ key: string; row: KeyRow }> {
  const created = await auth.api.createApiKey({
    body: {
      name: input.name,
      userId: input.ownerId,
      expiresIn: input.expiresDays ? input.expiresDays * 86_400 : null,
      permissions: { scope: input.scopes },
      rateLimitEnabled: input.rateLimitMax !== null,
      rateLimitMax: input.rateLimitMax ?? undefined,
      rateLimitTimeWindow: input.rateLimitWindowMs ?? undefined,
    },
  });
  await db
    .update(apikey)
    .set({ allowedIps: joinLines(input.allowedIps), note: input.note })
    .where(eq(apikey.id, created.id));
  const row = await getKey(created.id);
  if (!row) throw new Error('Kunci baru tidak ditemukan setelah dibuat');
  return { key: created.key, row };
}

export type KeyPatch = Partial<
  Pick<
    KeyInput,
    'name' | 'scopes' | 'rateLimitMax' | 'rateLimitWindowMs' | 'allowedIps' | 'note' | 'expiresDays'
  >
> & { enabled?: boolean };

export async function updateKey(id: string, patch: KeyPatch): Promise<KeyRow | null> {
  const existing = await getKey(id);
  if (!existing) return null;
  const body = {
    name: patch.name,
    enabled: patch.enabled,
    permissions: patch.scopes ? { scope: patch.scopes } : undefined,
    rateLimitEnabled: patch.rateLimitMax === undefined ? undefined : patch.rateLimitMax !== null,
    rateLimitMax: patch.rateLimitMax ?? undefined,
    rateLimitTimeWindow: patch.rateLimitWindowMs ?? undefined,
    expiresIn:
      patch.expiresDays === undefined
        ? undefined
        : patch.expiresDays
          ? patch.expiresDays * 86_400
          : null,
  };
  // Better Auth rejects an update with no plugin-owned fields (NO_VALUES_TO_UPDATE),
  // so skip it when only our extra columns (allowedIps/note) change.
  if (Object.values(body).some((v) => v !== undefined))
    await auth.api.updateApiKey({ body: { keyId: id, userId: existing.ownerId, ...body } });
  const extra: Partial<typeof apikey.$inferInsert> = {};
  if (patch.allowedIps !== undefined) extra.allowedIps = joinLines(patch.allowedIps);
  if (patch.note !== undefined) extra.note = patch.note;
  if (Object.keys(extra).length) await db.update(apikey).set(extra).where(eq(apikey.id, id));
  return getKey(id);
}

/** New key with the same settings; the old one keeps working for the grace period, then expires. */
export async function rotateKey(
  id: string,
  graceMs = ROTATION_GRACE_MS,
): Promise<{ key: string; row: KeyRow; old: KeyRow } | null> {
  const old = await getKey(id);
  if (!old || old.revokedAt) return null;
  const remainingDays = old.expiresAt
    ? Math.max(1, Math.ceil((old.expiresAt.getTime() - Date.now()) / 86_400_000))
    : null;
  const created = await createKey({
    name: old.name ?? 'key',
    ownerId: old.ownerId,
    scopes: old.scopes,
    expiresDays: remainingDays,
    rateLimitMax: old.rateLimitEnabled ? (old.rateLimitMax ?? null) : null,
    rateLimitWindowMs: old.rateLimitEnabled ? (old.rateLimitTimeWindow ?? null) : null,
    allowedIps: parseLines(old.allowedIps),
    note: old.note,
  });
  const graceUntil = new Date(Date.now() + graceMs);
  await db.update(apikey).set({ rotatedFromId: id }).where(eq(apikey.id, created.row.id));
  await db
    .update(apikey)
    .set({
      expiresAt: old.expiresAt && old.expiresAt < graceUntil ? old.expiresAt : graceUntil,
      updatedAt: new Date(),
    })
    .where(eq(apikey.id, id));
  return {
    key: created.key,
    row: (await getKey(created.row.id)) as KeyRow,
    old: (await getKey(id)) as KeyRow,
  };
}

/** Revoke = disable + expire now + stamp revokedAt. Rows are kept for history. */
export async function revokeKey(id: string): Promise<KeyRow | null> {
  const [d] = await db
    .update(apikey)
    .set({ enabled: false, revokedAt: new Date(), expiresAt: new Date(), updatedAt: new Date() })
    .where(eq(apikey.id, id))
    .returning({ id: apikey.id });
  return d ? getKey(id) : null;
}

export async function deleteKey(id: string): Promise<boolean> {
  const [d] = await db.delete(apikey).where(eq(apikey.id, id)).returning({ id: apikey.id });
  return Boolean(d);
}
