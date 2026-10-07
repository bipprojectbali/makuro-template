/** Public read of stored avatars at /api/storage/avatars/:userId/:file (keys are random, so URLs are unguessable and immutable). */
import { Elysia } from 'elysia';
import { storage, storageEnabled } from '../storage';
import { AVATAR_FILE, AVATAR_TYPES, type AvatarExt, STORAGE_DISABLED } from './app-avatar';

const USER_ID = /^[\w-]+$/;
const NOT_FOUND = { error: 'File tidak ditemukan.', code: 'FILE_NOT_FOUND' };

export const storageFilesApi = new Elysia({ prefix: '/storage' }).get(
  '/avatars/:userId/:file',
  async ({ params, status }) => {
    if (!storageEnabled()) return status(503, STORAGE_DISABLED);
    if (!USER_ID.test(params.userId) || !AVATAR_FILE.test(params.file))
      return status(404, NOT_FOUND);
    const obj = storage().file(`avatars/${params.userId}/${params.file}`);
    if (!(await obj.exists())) return status(404, NOT_FOUND);
    const ext = params.file.split('.').pop() as AvatarExt;
    return new Response(obj.stream(), {
      headers: {
        'content-type': AVATAR_TYPES[ext],
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  },
);
