/**
 * Singleton `app_setting` row access shared by every settings domain module.
 * Reads are cached briefly because the maintenance gate and branding run on
 * the request path; every write invalidates the cache.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { appSetting } from './db/schema';

export const SINGLETON_ID = 'singleton';
export type SettingsRow = typeof appSetting.$inferSelect;
export type SettingsInsert = typeof appSetting.$inferInsert;

const CACHE_TTL_MS = 5_000;
let cache: { row: SettingsRow | null; expires: number } | null = null;

export async function readSettingsRow(): Promise<SettingsRow | null> {
  if (cache && cache.expires > Date.now()) return cache.row;
  const [row] = await db.select().from(appSetting).where(eq(appSetting.id, SINGLETON_ID)).limit(1);
  cache = { row: row ?? null, expires: Date.now() + CACHE_TTL_MS };
  return row ?? null;
}

export async function upsertSettingsRow(values: Partial<SettingsInsert>): Promise<void> {
  await db
    .insert(appSetting)
    .values({ id: SINGLETON_ID, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSetting.id, set: { ...values, updatedAt: new Date() } });
  invalidateSettingsCache();
}

export function invalidateSettingsCache(): void {
  cache = null;
}

/** Newline-separated text column ↔ string[] (NULL = null). */
export function parseLines(raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined) return null;
  return raw
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}
export function joinLines(list: string[] | null): string | null {
  return list ? list.join('\n') : null;
}
