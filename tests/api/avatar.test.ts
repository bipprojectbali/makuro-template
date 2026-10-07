/** Avatar upload on object storage: guard, validation, storage round-trip and cleanup of replaced objects. */
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { api } from '../../server/api';
import { AVATAR_MAX_BYTES, ownAvatarKey, sniffImage } from '../../server/api/app-avatar';
import { auth } from '../../server/auth';
import { db } from '../../server/db';
import { user } from '../../server/db/schema';
import * as rolesMod from '../../server/roles';
import { storage } from '../../server/storage';
import { ensureBucket } from '../../server/storage/bucket';

const ID = `avatar-${crypto.randomUUID().slice(0, 8)}`;
type Actor = { id: string; name: string; email: string; image: string | null };
const ctx: { actor: Actor | null } = { actor: null };
const spies = [
  spyOn(auth.api, 'getSession').mockImplementation((async () =>
    ctx.actor ? { user: ctx.actor } : null) as unknown as typeof auth.api.getSession),
  spyOn(rolesMod, 'resolveUserRole').mockImplementation(async () => 'user'),
];

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const me = (): Actor => ({ id: ID, name: ID, email: `${ID}@test.local`, image: null });

async function upload(file?: Blob) {
  const form = new FormData();
  if (file) form.append('file', file, 'foto.png');
  const res = await api.handle(
    new Request('http://localhost/api/app/avatar', { method: 'POST', body: form }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, string | null> };
}
const get = (path: string) => api.handle(new Request(`http://localhost${path}`));
const dbImage = async () =>
  (await db.select({ image: user.image }).from(user).where(eq(user.id, ID)))[0]?.image;

beforeAll(async () => {
  const e = process.env;
  await ensureBucket({
    endpoint: e.S3_ENDPOINT as string,
    bucket: e.S3_BUCKET as string,
    accessKeyId: e.S3_ACCESS_KEY_ID as string,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY as string,
    region: e.S3_REGION,
  });
  const now = new Date();
  await db
    .insert(user)
    .values({ ...me(), emailVerified: false, role: 'user', createdAt: now, updatedAt: now });
});
afterAll(async () => {
  for (const s of spies) s.mockRestore();
  for (const f of await storage()
    .list({ prefix: `avatars/${ID}/` })
    .then((r) => r.contents ?? []))
    await storage().delete(f.key);
  await db.delete(user).where(eq(user.id, ID));
});

describe('avatar helpers', () => {
  test('sniffImage trusts magic bytes only', () => {
    expect(sniffImage(PNG)).toBe('png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBe('gif');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      null,
    );
  });
  test('ownAvatarKey only accepts our own URLs for the same user', () => {
    expect(ownAvatarKey('u1', '/api/storage/avatars/u1/abc.png')).toBe('avatars/u1/abc.png');
    expect(ownAvatarKey('u1', '/api/storage/avatars/u2/abc.png')).toBeNull();
    expect(ownAvatarKey('u1', '/api/storage/avatars/u1/../u2/abc.png')).toBeNull();
    expect(ownAvatarKey('u1', 'https://example.com/a.png')).toBeNull();
    expect(ownAvatarKey('u1', null)).toBeNull();
  });
});

describe('/api/app/avatar', () => {
  test('no session → 401', async () => {
    ctx.actor = null;
    const r = await upload(new Blob([PNG]));
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHORIZED');
  });

  test('storage not configured → 503 on upload and on file read', async () => {
    ctx.actor = me();
    const saved = process.env.S3_ENDPOINT;
    delete process.env.S3_ENDPOINT;
    try {
      const r = await upload(new Blob([PNG]));
      expect(r.status).toBe(503);
      expect(r.body.code).toBe('STORAGE_DISABLED');
      expect((await get(`/api/storage/avatars/${ID}/x.png`)).status).toBe(503);
    } finally {
      process.env.S3_ENDPOINT = saved;
    }
  });

  test('rejects missing file, fake image type and oversize', async () => {
    ctx.actor = me();
    expect((await upload()).status).toBe(400);
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/png' });
    const bad = await upload(svg);
    expect(bad.status).toBe(415);
    expect(bad.body.code).toBe('UNSUPPORTED_TYPE');
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(PNG);
    const huge = await upload(new Blob([big], { type: 'image/png' }));
    expect(huge.status).toBe(413);
    expect(huge.body.code).toBe('FILE_TOO_LARGE');
    expect(await dbImage()).toBeNull();
  });

  test('upload → served publicly; replace deletes the old object; delete clears it', async () => {
    ctx.actor = me();
    const first = await upload(new Blob([PNG], { type: 'image/png' }));
    expect(first.status).toBe(200);
    const url1 = first.body.image as string;
    expect(url1).toMatch(new RegExp(`^/api/storage/avatars/${ID}/[\\w-]+\\.png$`));
    expect(await dbImage()).toBe(url1);

    const res = await get(url1);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);

    ctx.actor = { ...me(), image: url1 }; // session refetched after the upload
    const second = await upload(new Blob([PNG]));
    expect(second.status).toBe(200);
    expect(second.body.image).not.toBe(url1);
    expect(
      await storage()
        .file(ownAvatarKey(ID, url1) as string)
        .exists(),
    ).toBe(false);
    expect((await get(url1)).status).toBe(404);

    ctx.actor = { ...me(), image: second.body.image };
    const del = await api.handle(
      new Request('http://localhost/api/app/avatar', { method: 'DELETE' }),
    );
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ image: null });
    expect(await dbImage()).toBeNull();
    expect(
      await storage()
        .file(ownAvatarKey(ID, second.body.image) as string)
        .exists(),
    ).toBe(false);
  });

  test('deleting the account deletes the stored photo', async () => {
    const gone = `${ID}-del`;
    const key = `avatars/${gone}/${crypto.randomUUID()}.png`;
    await storage().write(key, PNG, { type: 'image/png' });
    const now = new Date();
    await db.insert(user).values({
      id: gone,
      name: gone,
      email: `${gone}@test.local`,
      image: `/api/storage/${key}`,
      emailVerified: false,
      role: 'user',
      createdAt: now,
      updatedAt: now,
    });
    await (await auth.$context).internalAdapter.deleteUser(gone);
    expect(await storage().file(key).exists()).toBe(false);
  });

  test('file route rejects unexpected names and unknown files with JSON 404', async () => {
    for (const p of [
      `/api/storage/avatars/${ID}/..%2F..%2Fsecret.png`,
      `/api/storage/avatars/${ID}/evil.svg`,
      `/api/storage/avatars/${ID}/missing.png`,
    ]) {
      const res = await get(p);
      expect(res.status).toBe(404);
      expect(((await res.json()) as { code: string }).code).toBeString();
    }
  });
});
