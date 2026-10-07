/** Client helpers for the profile photo endpoints (/api/app/avatar). */
import { client } from './eden';

export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export const AVATAR_MAX_MB = 2;

function errorMessage(error: { value: unknown } | null, fallback: string): string {
  const v = error?.value as { error?: string } | undefined;
  return v?.error ?? fallback;
}

/** Upload a new photo; resolves to the stored image URL or throws the server's message. */
export async function uploadAvatar(file: File): Promise<string> {
  const { data, error } = await client.api.app.avatar.post({ file });
  if (error || !data?.image)
    throw new Error(errorMessage(error, 'Gagal mengunggah foto. Coba lagi.'));
  return data.image;
}

/** Remove the current photo (falls back to initials). */
export async function removeAvatar(): Promise<void> {
  const { error } = await client.api.app.avatar.delete();
  if (error) throw new Error(errorMessage(error, 'Gagal menghapus foto. Coba lagi.'));
}
