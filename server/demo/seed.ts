/**
 * Sample data for a fresh demo visitor. Derived apps: replace/extend this one
 * function with their own tables. Rows must reference `userId` with
 * `onDelete: 'cascade'` so the demo cleanup removes them with the user.
 */
import { db } from '../db';
import { post } from '../db/schema';

export async function seedDemo(userId: string): Promise<void> {
  await db.insert(post).values([
    {
      authorId: userId,
      title: 'Selamat datang di demo',
      content: 'Data ini milikmu sendiri dan akan dihapus otomatis.',
    },
    {
      authorId: userId,
      title: 'Coba ubah atau hapus aku',
      content: 'Semua perubahan hanya terlihat di sesi demo ini.',
    },
  ]);
}
