/** Deletes expired demo users (and their cascaded data) on a schedule. */
import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../db';
import { user } from '../db/schema';
import { logger } from '../logger';
import { effectiveDemoTtlHours, getDemo } from '../settings-demo';

const BATCH = 500;
const HOUR_MS = 3_600_000;
const CHECK_INTERVAL_MS = 60 * 60_000;

/**
 * Delete anonymous users older than the demo TTL; returns how many were removed.
 * Runs even when demo is switched off so leftovers still expire. Plain DB delete is
 * enough: FKs cascade (or set null on logs) and demo users can't upload to storage.
 */
export async function purgeExpiredDemoUsers(now = new Date()): Promise<number> {
  const ttlHours = effectiveDemoTtlHours(await getDemo());
  const cutoff = new Date(now.getTime() - ttlHours * HOUR_MS);
  const expired = and(eq(user.isAnonymous, true), lt(user.createdAt, cutoff));
  let total = 0;
  for (;;) {
    const rows = await db
      .delete(user)
      .where(inArray(user.id, db.select({ id: user.id }).from(user).where(expired).limit(BATCH)))
      .returning({ id: user.id });
    total += rows.length;
    if (rows.length < BATCH) return total;
  }
}

/** Checked hourly (first run shortly after boot). Safe to call once at boot. */
export function startDemoCleanupScheduler(): void {
  const tick = async () => {
    try {
      const deleted = await purgeExpiredDemoUsers();
      if (deleted > 0) logger.info({ deleted }, 'expired demo users purged');
    } catch (err) {
      logger.warn({ err }, 'demo cleanup scheduler failed');
    }
  };
  setInterval(tick, CHECK_INTERVAL_MS).unref?.();
  setTimeout(tick, 20_000).unref?.();
}
