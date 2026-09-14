/** Feature flags stored as JSON on the settings row; read by server code and exposed publicly as a key→boolean map. */
import { readSettingsRow, type SettingsRow, upsertSettingsRow } from './settings.core';

export type FeatureFlag = { key: string; enabled: boolean; description: string };

export const FLAG_KEY_RE = /^[a-z][a-z0-9_-]{1,49}$/;
export const MAX_FLAGS = 100;

export function parseFeatureFlags(row: SettingsRow | null): FeatureFlag[] {
  const raw = row?.featureFlags;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is FeatureFlag => Boolean(f) && typeof (f as FeatureFlag).key === 'string')
    .map((f) => ({
      key: f.key,
      enabled: Boolean(f.enabled),
      description: typeof f.description === 'string' ? f.description : '',
    }));
}

/** Validate + de-duplicate; throws on invalid keys so the API can 400. */
export function normalizeFeatureFlags(flags: FeatureFlag[]): FeatureFlag[] {
  const seen = new Set<string>();
  const out: FeatureFlag[] = [];
  for (const f of flags) {
    const key = f.key.trim().toLowerCase();
    if (!FLAG_KEY_RE.test(key))
      throw new Error(
        `Kunci flag tidak valid: "${f.key}" (huruf kecil, angka, - atau _, 2–50 karakter)`,
      );
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      enabled: Boolean(f.enabled),
      description: (f.description ?? '').trim().slice(0, 200),
    });
  }
  if (out.length > MAX_FLAGS) throw new Error(`Maksimal ${MAX_FLAGS} flag`);
  return out;
}

export function flagsToMap(flags: FeatureFlag[]): Record<string, boolean> {
  return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  return parseFeatureFlags(await readSettingsRow());
}

/** Server-side check. Unknown flags are off. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  return (await getFeatureFlags()).some((f) => f.key === key && f.enabled);
}

export async function upsertFeatureFlags(flags: FeatureFlag[]): Promise<FeatureFlag[]> {
  const normalized = normalizeFeatureFlags(flags);
  await upsertSettingsRow({ featureFlags: normalized });
  return normalized;
}
