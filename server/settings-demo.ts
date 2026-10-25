/** Demo sandbox switch + TTL (singleton `app_setting` row), toggled from /dev like maintenance. */
import { isDemoBuild } from './demo-build';
import { readSettingsRow, type SettingsRow, upsertSettingsRow } from './settings.core';

export type DemoSettings = { enabled: boolean; ttlHours: number | null };
export const DEMO_DEFAULTS = { ttlHours: 24, maxTtlHours: 24 * 7 };

/** A demo build forces `enabled` on — the stored row can only set the TTL. */
export function parseDemo(row: SettingsRow | null): DemoSettings {
  return {
    enabled: isDemoBuild() || Boolean(row?.demoEnabled),
    ttlHours: row?.demoTtlHours ?? null,
  };
}

/** TTL actually applied (stored override or default). */
export function effectiveDemoTtlHours(s: DemoSettings): number {
  return s.ttlHours ?? DEMO_DEFAULTS.ttlHours;
}

/** True once a demo account created at `createdAt` is past the TTL (same cutoff as the purge job). */
export async function isDemoExpired(createdAt: Date | string, now = Date.now()): Promise<boolean> {
  const ttlMs = effectiveDemoTtlHours(await getDemo()) * 3_600_000;
  return new Date(createdAt).getTime() + ttlMs < now;
}

export async function getDemo(): Promise<DemoSettings> {
  return parseDemo(await readSettingsRow());
}

export async function upsertDemo(s: DemoSettings): Promise<DemoSettings> {
  await upsertSettingsRow({ demoEnabled: s.enabled, demoTtlHours: s.ttlHours });
  return getDemo();
}
