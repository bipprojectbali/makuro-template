/** API key management (super-admin). Plain keys are returned exactly once, on create and rotate. */
import { Elysia, t } from 'elysia';
import { getKey, keyStats, listKeys } from '../api-keys/query';
import { SCOPES } from '../api-keys/scopes';
import {
  createKey,
  deleteKey,
  type KeyPatch,
  revokeKey,
  rotateKey,
  updateKey,
} from '../api-keys/service';
import { usageBreakdown, usageRecent, usageSummary } from '../api-keys/usage';
import { AUDIT_ACTIONS, audit } from '../audit';
import { requireRole } from '../guard';
import { ROLES } from '../permissions';
import {
  keyInputSchema,
  keyPatchSchema,
  normalizeKeyInput,
  normalizePatch,
} from './api-keys.schema';

const ListQuery = t.Object({
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  search: t.Optional(t.String()),
  status: t.Optional(t.String()),
  ownerId: t.Optional(t.String()),
  scope: t.Optional(t.String()),
});

export const apiKeysApi = new Elysia({ prefix: '/api-keys' })
  .get(
    '/',
    async ({ request, query }) => {
      await requireRole(request, ROLES.SUPER_ADMIN);
      return listKeys(query);
    },
    { query: ListQuery },
  )
  .get('/stats', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return keyStats();
  })
  .get('/scopes', async ({ request }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return { scopes: SCOPES };
  })
  .post(
    '/',
    async ({ request, body, status }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const input = await normalizeKeyInput(body);
      if ('error' in input) return status(400, { error: input.error });
      const { key, row } = await createKey(input.value);
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.APIKEY_CREATE,
        targetType: 'apikey',
        targetId: row.id,
        summary: `API key "${row.name}" dibuat untuk ${row.ownerEmail ?? row.ownerId} (${row.scopes.join(', ') || 'tanpa scope'})`,
        meta: { scopes: row.scopes, expiresAt: row.expiresAt, ownerId: row.ownerId },
      });
      return { key, row };
    },
    { body: keyInputSchema },
  )
  .get('/:id', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    return (await getKey(params.id)) ?? status(404, { error: 'Key tidak ditemukan' });
  })
  .get('/:id/usage', async ({ request, params, status }) => {
    await requireRole(request, ROLES.SUPER_ADMIN);
    if (!(await getKey(params.id))) return status(404, { error: 'Key tidak ditemukan' });
    const [summary, breakdown, recent] = await Promise.all([
      usageSummary(params.id),
      usageBreakdown(params.id),
      usageRecent(params.id),
    ]);
    return { summary, breakdown, recent };
  })
  .put(
    '/:id',
    async ({ request, params, body, status }) => {
      const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
      const patch = await normalizePatch(params.id, body as KeyPatch);
      if ('error' in patch) return status(400, { error: patch.error });
      const row = await updateKey(params.id, patch.value);
      if (!row) return status(404, { error: 'Key tidak ditemukan' });
      void audit({
        actor: user,
        headers: request.headers,
        action: AUDIT_ACTIONS.APIKEY_UPDATE,
        targetType: 'apikey',
        targetId: row.id,
        summary: `API key "${row.name}" diubah${body.enabled === false ? ' (dinonaktifkan)' : ''}`,
        meta: body,
      });
      return row;
    },
    { body: keyPatchSchema },
  )
  .post('/:id/rotate', async ({ request, params, status }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const r = await rotateKey(params.id);
    if (!r) return status(404, { error: 'Key tidak ditemukan atau sudah dicabut' });
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.APIKEY_ROTATE,
      targetType: 'apikey',
      targetId: params.id,
      summary: `API key "${r.old.name}" dirotasi; kunci lama berakhir ${r.old.expiresAt?.toISOString() ?? '-'}`,
      meta: { newId: r.row.id },
    });
    return r;
  })
  .post('/:id/revoke', async ({ request, params, status }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const row = await revokeKey(params.id);
    if (!row) return status(404, { error: 'Key tidak ditemukan' });
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.APIKEY_REVOKE,
      targetType: 'apikey',
      targetId: row.id,
      summary: `API key "${row.name}" dicabut`,
    });
    return row;
  })
  .delete('/:id', async ({ request, params, status }) => {
    const { user } = await requireRole(request, ROLES.SUPER_ADMIN);
    const row = await getKey(params.id);
    if (!row || !(await deleteKey(params.id))) return status(404, { error: 'Key tidak ditemukan' });
    void audit({
      actor: user,
      headers: request.headers,
      action: AUDIT_ACTIONS.APIKEY_DELETE,
      targetType: 'apikey',
      targetId: params.id,
      summary: `API key "${row.name}" dihapus permanen beserta riwayat pemakaiannya`,
    });
    return { ok: true };
  });
