import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mock } from 'bun:test';

// Bypass auth — settings PUT requires super-admin; GET is public.
mock.module('../guard', () => ({
  requireRole: async () => ({ user: { id: 'u-super' }, role: 'super-admin' }),
}));

import Elysia from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { appSetting } from '../db/schema';
import { settingsApi } from './settings';

const app = new Elysia().use(settingsApi);

const SINGLETON = 'singleton';

async function get() {
  const res = await app.handle(new Request('http://localhost/settings'));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function put(body: Record<string, unknown>) {
  const res = await app.handle(
    new Request('http://localhost/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  await db.delete(appSetting).where(eq(appSetting.id, SINGLETON)).catch(() => {});
});

// ─── GET /settings ────────────────────────────────────────────────────────────

describe('GET /settings', () => {
  test('returns defaults when no row exists', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.emailAuthEnabled).toBe(false);
    expect(body.signupEnabled).toBe(true);
  });

  test('returns persisted values after an upsert', async () => {
    await put({ emailAuthEnabled: true, signupEnabled: false });
    const { body } = await get();
    expect(body.emailAuthEnabled).toBe(true);
    expect(body.signupEnabled).toBe(false);
  });
});

// ─── PUT /settings ────────────────────────────────────────────────────────────

describe('PUT /settings', () => {
  test('creates the singleton row and returns updated values', async () => {
    const { status, body } = await put({ emailAuthEnabled: true, signupEnabled: true });
    expect(status).toBe(200);
    expect(body.emailAuthEnabled).toBe(true);
    expect(body.signupEnabled).toBe(true);
  });

  test('updates existing row (idempotent upsert)', async () => {
    await put({ emailAuthEnabled: true, signupEnabled: true });
    const { body } = await put({ emailAuthEnabled: false, signupEnabled: false });
    expect(body.emailAuthEnabled).toBe(false);
    expect(body.signupEnabled).toBe(false);
  });

  test('rejects request missing required fields', async () => {
    const { status } = await put({ emailAuthEnabled: true });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('rejects non-boolean values', async () => {
    const { status } = await put({ emailAuthEnabled: 'yes', signupEnabled: 1 });
    expect(status).toBeGreaterThanOrEqual(400);
  });
});
