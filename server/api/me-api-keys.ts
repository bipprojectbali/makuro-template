/**
 * Personal API keys (any signed-in role). Scopes are clamped to the caller's
 * role, keys can only be managed by their owner, and a key can never manage
 * keys (session only). Every change is audited with the user as actor.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { getKey, listKeys } from '../api-keys/query';
import { SCOPES, scopesForRole } from '../api-keys/scopes';
import {
  createKey,
  deleteKey,
  type KeyPatch,
  revokeKey,
  rotateKey,
  updateKey,
} from '../api-keys/service';
import { usageAnomalies, usageBreakdown, usageRecent, usageSummary } from '../api-keys/usage';
import { AUDIT_ACTIONS, type AuditAction, audit } from '../audit';
import { db } from '../db';
import { apikey } from '../db/schema';
import { type Actor, resolveActor } from '../guard';
import {
  keyInputSchema,
  keyPatchSchema,
  normalizeKeyInput,
  normalizePatch,
} from './api-keys.schema';

/** Live (not revoked) keys one user may hold. */
export const MAX_PERSONAL_KEYS = 10;

const personalInput = t.Omit(keyInputSchema, ['ownerId']);

async function liveKeyCount(ownerId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(apikey)
    .where(and(eq(apikey.referenceId, ownerId), isNull(apikey.revokedAt)));
  return r?.n ?? 0;
}

/** The key only if it belongs to the caller. */
async function ownKey(id: string, me: Actor) {
  const row = await getKey(id);
  return row && row.ownerId === me.user.id ? row : null;
}

const log = (me: Actor, headers: Headers, action: AuditAction, targetId: string, summary: string) =>
  void audit({ actor: me.user, headers, action, targetType: 'apikey', targetId, summary });

export const meApiKeysApi = new Elysia({ prefix: '/me/api-keys' })
  .derive(async ({ request }) => ({ me: await resolveActor(request) }))
  .onBeforeHandle(({ me, status }) => {
    if (!me) return status(401, { error: 'Unauthorized' });
    if (me.viaApiKey) return status(403, { error: 'Kunci API tidak bisa mengelola kunci' });
  })
  .get('/', async ({ me }) => {
    const m = me as Actor;
    const list = await listKeys({ ownerId: m.user.id, limit: String(MAX_PERSONAL_KEYS * 2) });
    const allowed = scopesForRole(m.role);
    return {
      ...list,
      scopes: SCOPES.filter((s) => allowed.includes(s.id)),
      max: MAX_PERSONAL_KEYS,
      live: await liveKeyCount(m.user.id),
    };
  })
  .post(
    '/',
    async ({ me, request, body, status }) => {
      const m = me as Actor;
      if ((await liveKeyCount(m.user.id)) >= MAX_PERSONAL_KEYS)
        return status(400, { error: `Maksimum ${MAX_PERSONAL_KEYS} kunci aktif per akun` });
      const input = await normalizeKeyInput({ ...body, ownerId: m.user.id });
      if ('error' in input) return status(400, { error: input.error });
      const { key, row } = await createKey(input.value);
      log(
        m,
        request.headers,
        AUDIT_ACTIONS.APIKEY_CREATE,
        row.id,
        `Kunci pribadi "${row.name}" dibuat (${row.scopes.join(', ')})`,
      );
      return { key, row };
    },
    { body: personalInput },
  )
  .get('/:id/usage', async ({ me, params, status }) => {
    if (!(await ownKey(params.id, me as Actor)))
      return status(404, { error: 'Key tidak ditemukan' });
    const [summary, breakdown, recent, anomalies] = await Promise.all([
      usageSummary(params.id),
      usageBreakdown(params.id),
      usageRecent(params.id),
      usageAnomalies(params.id),
    ]);
    return { summary, breakdown, recent, anomalies };
  })
  .put(
    '/:id',
    async ({ me, request, params, body, status }) => {
      const m = me as Actor;
      if (!(await ownKey(params.id, m))) return status(404, { error: 'Key tidak ditemukan' });
      const patch = await normalizePatch(params.id, body as KeyPatch);
      if ('error' in patch) return status(400, { error: patch.error });
      const row = await updateKey(params.id, patch.value);
      if (!row) return status(404, { error: 'Key tidak ditemukan' });
      log(
        m,
        request.headers,
        AUDIT_ACTIONS.APIKEY_UPDATE,
        row.id,
        `Kunci pribadi "${row.name}" diubah`,
      );
      return row;
    },
    { body: keyPatchSchema },
  )
  .post('/:id/rotate', async ({ me, request, params, status }) => {
    const m = me as Actor;
    if (!(await ownKey(params.id, m))) return status(404, { error: 'Key tidak ditemukan' });
    const r = await rotateKey(params.id);
    if (!r) return status(404, { error: 'Key tidak ditemukan atau sudah dicabut' });
    log(
      m,
      request.headers,
      AUDIT_ACTIONS.APIKEY_ROTATE,
      params.id,
      `Kunci pribadi "${r.old.name}" dirotasi`,
    );
    return r;
  })
  .post('/:id/revoke', async ({ me, request, params, status }) => {
    const m = me as Actor;
    if (!(await ownKey(params.id, m))) return status(404, { error: 'Key tidak ditemukan' });
    const row = await revokeKey(params.id);
    if (!row) return status(404, { error: 'Key tidak ditemukan' });
    log(
      m,
      request.headers,
      AUDIT_ACTIONS.APIKEY_REVOKE,
      row.id,
      `Kunci pribadi "${row.name}" dicabut`,
    );
    return row;
  })
  .delete('/:id', async ({ me, request, params, status }) => {
    const m = me as Actor;
    const row = await ownKey(params.id, m);
    if (!row || !(await deleteKey(params.id))) return status(404, { error: 'Key tidak ditemukan' });
    log(
      m,
      request.headers,
      AUDIT_ACTIONS.APIKEY_DELETE,
      params.id,
      `Kunci pribadi "${row.name}" dihapus`,
    );
    return { ok: true };
  });
