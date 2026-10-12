/** Demo sandbox switch + TTL (singleton `app_setting` row), toggled from /dev like maintenance. */
import { readSettingsRow, type SettingsRow, upsertSettingsRow } from './settings.core';

export type DemoSettings = { enabled: boolean; ttlHours: number | null };
export const DEMO_DEFAULTS = { ttlHours: 24, maxTtlHours: 24 * 7 };

export function parseDemo(row: SettingsRow | null): DemoSettings {
  return { enabled: Boolean(row?.demoEnabled), ttlHours: row?.demoTtlHours ?? null };
}

/** TTL actually applied (stored override or default). */
export function effectiveDemoTtlHours(s: DemoSettings): number {
  return s.ttlHours ?? DEMO_DEFAULTS.ttlHours;
}

export async function getDemo(): Promise<DemoSettings> {
  return parseDemo(await readSettingsRow());
}

export async function upsertDemo(s: DemoSettings): Promise<DemoSettings> {
  await upsertSettingsRow({ demoEnabled: s.enabled, demoTtlHours: s.ttlHours });
  return getDemo();
}
