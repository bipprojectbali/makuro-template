/** Profile photo upload/removal on object storage; routes live in app.ts so the /api/app guard covers them. */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user } from '../db/schema';
import { logger } from '../logger';
import { storage, storageEnabled } from '../storage';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_URL_PREFIX = '/api/storage/avatars/';

/** Allowed image types: extension → MIME. SVG is excluded on purpose (script inside an image = XSS). */
export const AVATAR_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
export type AvatarExt = keyof typeof AVATAR_TYPES;
/** Stored file names: `<uuid>.<ext>` — anything else (traversal, foreign URLs) is rejected. */
export const AVATAR_FILE = /^[\w-]+\.(png|jpg|webp|gif)$/;
export const STORAGE_DISABLED = {
  error: 'Penyimpanan file belum aktif. Hubungi admin.',
  code: 'STORAGE_DISABLED',
};

/** Detect the image type from its first bytes; the client-sent content-type is not trusted. */
export function sniffImage(b: Uint8Array): AvatarExt | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  return null;
}

/** Storage key behind one of our avatar URLs for `userId`, or null for foreign/external images. */
export function ownAvatarKey(userId: string, image: string | null | undefined): string | null {
  const prefix = `${AVATAR_URL_PREFIX}${userId}/`;
  if (!image?.startsWith(prefix)) return null;
  const file = image.slice(prefix.length);
  return AVATAR_FILE.test(file) ? `avatars/${userId}/${file}` : null;
}

type Fail = { status: 400 | 413 | 415 | 503; error: string; code: string };
export type AvatarResult = { ok: true; image: string | null } | ({ ok: false } & Fail);

const fail = (status: Fail['status'], code: string, error: string): AvatarResult => ({
  ok: false,
  status,
  code,
  error,
});
const disabled = () => fail(503, STORAGE_DISABLED.code, STORAGE_DISABLED.error);

async function dropObject(userId: string, image: string | null | undefined): Promise<void> {
  const key = ownAvatarKey(userId, image);
  if (!key) return;
  try {
    await storage().file(key).delete();
  } catch (err) {
    // The new image is already saved; a leftover object only costs space.
    logger.warn({ err, userId, key }, 'failed to delete old avatar object');
  }
}

/** Validate, store and assign a new avatar; the previous one we own is deleted afterwards. */
export async function uploadAvatar(
  userId: string,
  oldImage: string | null | undefined,
  file: unknown,
): Promise<AvatarResult> {
  if (!storageEnabled()) return disabled();
  if (!(file instanceof Blob) || file.size === 0) {
    return fail(400, 'FILE_REQUIRED', 'Pilih file gambar untuk diunggah.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return fail(413, 'FILE_TOO_LARGE', 'Ukuran foto maksimal 2 MB. Pilih gambar yang lebih kecil.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) {
    return fail(415, 'UNSUPPORTED_TYPE', 'Format foto harus PNG, JPEG, WEBP, atau GIF.');
  }
  const name = `${crypto.randomUUID()}.${ext}`;
  await storage().write(`avatars/${userId}/${name}`, bytes, { type: AVATAR_TYPES[ext] });
  const image = `${AVATAR_URL_PREFIX}${userId}/${name}`;
  await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId));
  await dropObject(userId, oldImage);
  return { ok: true, image };
}

/** Clear the avatar; the stored object is deleted only when it is ours. */
export async function removeAvatar(
  userId: string,
  oldImage: string | null | undefined,
): Promise<AvatarResult> {
  if (ownAvatarKey(userId, oldImage) && !storageEnabled()) return disabled();
  await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, userId));
  await dropObject(userId, oldImage);
  return { ok: true, image: null };
}
