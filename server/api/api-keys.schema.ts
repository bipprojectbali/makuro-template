/** Validation + normalisation for API key create/update bodies. */
import { t } from 'elysia';
import { getKey } from '../api-keys/query';
import { isScope, type Scope } from '../api-keys/scopes';
import { clampScopes, type KeyInput, type KeyPatch } from '../api-keys/service';
import { ROLES } from '../permissions';

const MAX_DAYS = 365;
const MIN_WINDOW_MS = 1_000;
const MAX_WINDOW_MS = 86_400_000;
const IP_RE = /^[0-9a-fA-F.:]{2,45}$/;

export const keyInputSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 60 }),
  ownerId: t.String({ minLength: 1 }),
  scopes: t.Array(t.String(), { maxItems: 30 }),
  expiresDays: t.Nullable(t.Integer({ minimum: 1, maximum: MAX_DAYS })),
  rateLimitMax: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 1_000_000 }))),
  rateLimitWindowMs: t.Optional(
    t.Nullable(t.Integer({ minimum: MIN_WINDOW_MS, maximum: MAX_WINDOW_MS })),
  ),
  allowedIps: t.Optional(
    t.Nullable(t.Array(t.String({ pattern: IP_RE.source, maxLength: 45 }), { maxItems: 50 })),
  ),
  note: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
});

export const keyPatchSchema = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 60 })),
  scopes: t.Optional(t.Array(t.String(), { maxItems: 30 })),
  enabled: t.Optional(t.Boolean()),
  expiresDays: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: MAX_DAYS }))),
  rateLimitMax: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 1_000_000 }))),
  rateLimitWindowMs: t.Optional(
    t.Nullable(t.Integer({ minimum: MIN_WINDOW_MS, maximum: MAX_WINDOW_MS })),
  ),
  allowedIps: t.Optional(
    t.Nullable(t.Array(t.String({ pattern: IP_RE.source, maxLength: 45 }), { maxItems: 50 })),
  ),
  note: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
});

type Body = typeof keyInputSchema.static;
type Ok<T> = { value: T };
type Err = { error: string };

function validScopes(list: string[]): Scope[] | null {
  const bad = list.find((s) => !isScope(s));
  return bad ? null : (list as Scope[]);
}

/** Validate scopes against the catalog and the owner's role; "never expires" only for super-admin owners. */
export async function normalizeKeyInput(body: Body): Promise<Ok<KeyInput> | Err> {
  const scopes = validScopes(body.scopes);
  if (!scopes) return { error: 'Scope tidak dikenal' };
  const clamped = await clampScopes(body.ownerId, scopes);
  if (!clamped) return { error: 'Pemilik tidak ditemukan' };
  if (clamped.scopes.length !== scopes.length)
    return { error: `Role pemilik (${clamped.role}) tidak mengizinkan sebagian scope` };
  if (body.expiresDays === null && clamped.role !== ROLES.SUPER_ADMIN)
    return { error: 'Kunci tanpa kedaluwarsa hanya untuk pemilik super-admin' };
  return {
    value: {
      name: body.name.trim(),
      ownerId: body.ownerId,
      scopes,
      expiresDays: body.expiresDays,
      rateLimitMax: body.rateLimitMax ?? null,
      rateLimitWindowMs: body.rateLimitWindowMs ?? null,
      allowedIps: body.allowedIps?.length ? body.allowedIps : null,
      note: body.note?.trim() || null,
    },
  };
}

export async function normalizePatch(keyId: string, body: KeyPatch): Promise<Ok<KeyPatch> | Err> {
  const patch: KeyPatch = { ...body };
  if (body.scopes) {
    const scopes = validScopes(body.scopes);
    if (!scopes) return { error: 'Scope tidak dikenal' };
    const key = await getKey(keyId);
    if (!key) return { error: 'Key tidak ditemukan' };
    const clamped = await clampScopes(key.ownerId, scopes);
    if (!clamped || clamped.scopes.length !== scopes.length)
      return { error: 'Role pemilik tidak mengizinkan sebagian scope' };
    if (body.expiresDays === null && clamped.role !== ROLES.SUPER_ADMIN)
      return { error: 'Kunci tanpa kedaluwarsa hanya untuk pemilik super-admin' };
    patch.scopes = scopes;
  }
  if (body.allowedIps !== undefined)
    patch.allowedIps = body.allowedIps?.length ? body.allowedIps : null;
  if (body.name !== undefined) patch.name = body.name.trim();
  return { value: patch };
}
