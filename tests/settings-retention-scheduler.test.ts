import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { upsertSettingsRow } from '../server/settings.core';
import {
  getRetention,
  startRetentionScheduler,
  upsertRetention,
} from '../server/settings-retention';

const OFF = {
  visitDays: null,
  loginDays: null,
  rateLimitDays: null,
  auditDays: null,
  apiUsageDays: null,
};
const timer = { unref() {} } as unknown as ReturnType<typeof setTimeout>;
let tick: () => Promise<void>;
let intervalMs = 0;

beforeAll(async () => {
  await upsertRetention(OFF);
  await upsertSettingsRow({ retentionLastRunAt: null, retentionLastResult: null });
  // Capture the scheduler's tick instead of letting real timers fire.
  const t = spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => Promise<void>) => {
    tick = fn;
    return timer;
  }) as unknown as typeof setTimeout);
  const i = spyOn(globalThis, 'setInterval').mockImplementation(((_: unknown, ms: number) => {
    intervalMs = ms;
    return timer;
  }) as unknown as typeof setInterval);
  startRetentionScheduler();
  t.mockRestore();
  i.mockRestore();
});

afterAll(async () => {
  await upsertRetention(OFF);
  await upsertSettingsRow({ retentionLastRunAt: null, retentionLastResult: null });
});

describe('startRetentionScheduler', () => {
  test('checks hourly', () => {
    expect(intervalMs).toBe(60 * 60_000);
  });

  test('does nothing while no table has a retention window', async () => {
    await tick();
    expect((await getRetention()).lastRunAt).toBeNull();
  });

  test('runs once when configured, then waits a full day', async () => {
    // test-only: 10 years, old enough that no real test row is purged.
    await upsertRetention({ ...OFF, visitDays: 3650 });
    await tick();
    const first = await getRetention();
    expect(first.lastRunAt).not.toBeNull();
    expect(first.lastResult?.trigger).toBe('schedule');

    await tick();
    expect((await getRetention()).lastRunAt).toBe(first.lastRunAt);
  });
});
