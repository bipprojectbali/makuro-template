import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { appSetting, visitLog } from '../server/db/schema';
import { invalidateSettingsCache } from '../server/settings.core';
import {
  BRANDING_DEFAULTS,
  effectiveBranding,
  getBranding,
  upsertBranding,
} from '../server/settings-branding';
import {
  flagsToMap,
  isFeatureEnabled,
  normalizeFeatureFlags,
  upsertFeatureFlags,
} from '../server/settings-features';
import {
  getMaintenance,
  isMaintenanceExempt,
  shouldBlock,
  upsertMaintenance,
} from '../server/settings-maintenance';
import { getRetention, runRetention, upsertRetention } from '../server/settings-retention';

afterAll(async () => {
  await db
    .delete(appSetting)
    .where(eq(appSetting.id, 'singleton'))
    .catch(() => {});
  invalidateSettingsCache();
});

describe('branding', () => {
  test('falls back to defaults for empty overrides and persists trimmed values', async () => {
    expect(effectiveBranding({ appName: '  ', appTagline: null, supportUrl: null })).toEqual(
      BRANDING_DEFAULTS,
    );
    await upsertBranding({ appName: ' Acme ', appTagline: 'Portal internal', supportUrl: '' });
    const b = await getBranding();
    expect(b.appName).toBe('Acme');
    expect(b.appTagline).toBe('Portal internal');
    expect(b.supportUrl).toBeNull();
  });
});

describe('feature flags', () => {
  test('normalizes keys, de-duplicates and validates', () => {
    const out = normalizeFeatureFlags([
      { key: ' Beta_Search ', enabled: true, description: 'x' },
      { key: 'beta_search', enabled: false, description: 'dup' },
    ]);
    expect(out).toEqual([{ key: 'beta_search', enabled: true, description: 'x' }]);
    expect(flagsToMap(out)).toEqual({ beta_search: true });
    expect(() =>
      normalizeFeatureFlags([{ key: 'Bad Key!', enabled: true, description: '' }]),
    ).toThrow();
  });
  test('isFeatureEnabled reads the stored flags; unknown flags are off', async () => {
    await upsertFeatureFlags([{ key: 'new-dashboard', enabled: true, description: '' }]);
    expect(await isFeatureEnabled('new-dashboard')).toBe(true);
    expect(await isFeatureEnabled('nope')).toBe(false);
  });
});

describe('maintenance', () => {
  test('exempts login/auth/assets and blocks by role', () => {
    expect(isMaintenanceExempt('/login')).toBe(true);
    expect(isMaintenanceExempt('/api/auth/sign-in/email')).toBe(true);
    expect(isMaintenanceExempt('/dev')).toBe(false);
    const on = { enabled: true, message: null, allowRoles: null };
    expect(shouldBlock(on, '/dev', 'super-admin')).toBe(false);
    expect(shouldBlock(on, '/dashboard', 'admin')).toBe(true);
    expect(shouldBlock(on, '/profile', null)).toBe(true);
    expect(
      shouldBlock({ ...on, allowRoles: ['admin', 'super-admin'] }, '/dashboard', 'admin'),
    ).toBe(false);
    expect(shouldBlock({ ...on, enabled: false }, '/profile', null)).toBe(false);
  });
  test('persists and re-reads', async () => {
    await upsertMaintenance({
      enabled: true,
      message: ' Sebentar ya ',
      allowRoles: ['super-admin'],
    });
    const m = await getMaintenance();
    expect(m.enabled).toBe(true);
    expect(m.message).toBe('Sebentar ya');
    expect(m.allowRoles).toEqual(['super-admin']);
    await upsertMaintenance({ enabled: false, message: null, allowRoles: null });
  });
});

describe('retention', () => {
  test('deletes only rows older than the configured age and records the run', async () => {
    const TAG = `ret-${crypto.randomUUID().slice(0, 8)}`;
    const old = new Date(Date.now() - 40 * 86_400_000);
    const [a, b] = await db
      .insert(visitLog)
      .values([
        { path: `/${TAG}/old`, isBot: false, createdAt: old },
        { path: `/${TAG}/new`, isBot: false },
      ])
      .returning({ id: visitLog.id });
    await upsertRetention({ visitDays: 30, loginDays: null, rateLimitDays: null, auditDays: null });
    const result = await runRetention('manual');
    expect(result.deleted.visitDays).toBeGreaterThanOrEqual(1);
    expect(result.deleted.loginDays).toBe(0);
    const left = await db.select({ id: visitLog.id }).from(visitLog).where(eq(visitLog.id, a.id));
    expect(left.length).toBe(0);
    const kept = await db.select({ id: visitLog.id }).from(visitLog).where(eq(visitLog.id, b.id));
    expect(kept.length).toBe(1);
    const state = await getRetention();
    expect(state.lastRunAt).not.toBeNull();
    expect(state.lastResult?.trigger).toBe('manual');
    await db.delete(visitLog).where(eq(visitLog.id, b.id));
    await upsertRetention({
      visitDays: null,
      loginDays: null,
      rateLimitDays: null,
      auditDays: null,
    });
  });
});
