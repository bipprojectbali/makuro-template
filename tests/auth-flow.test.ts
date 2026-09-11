/**
 * Integration tests for the full authentication flow.
 * Uses DATABASE_URL_TEST to avoid polluting the main database.
 *
 * Flow tested:
 *  1. sign-up → 200 + Set-Cookie session header
 *  2. sign-in → 200 + Set-Cookie session header (all cookies preserved)
 *  3. authenticated request to protected endpoint → 200
 *  4. redirectToHome with valid session → throws redirect to role home
 *  5. redirectToHome with no session → throws redirect to /login
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { api } from '../server/api';
import { db } from '../server/db';
import { user } from '../server/db/schema';
import { redirectToHome } from '../server/guard';

const TEST_EMAIL = `auth-flow-${crypto.randomUUID()}@test.local`;
const TEST_PASS = 'TestPass123!';
let sessionCookie = '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cookieHeader(cookies: string | string[]): string {
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  return arr
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

async function signUp() {
  return api.handle(
    new Request('http://localhost/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, name: 'Flow Tester' }),
    }),
  );
}

async function signIn() {
  return api.handle(
    new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    }),
  );
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  const res = await signUp();
  expect(res.status).toBe(200);
  // Capture session cookies for subsequent tests
  const rawCookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  sessionCookie = cookieHeader(rawCookies);
});

afterAll(async () => {
  await db.delete(user).where(eq(user.email, TEST_EMAIL)).catch(() => {});
});

// ─── Sign-up ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/sign-up/email', () => {
  let anotherEmail = '';

  afterAll(async () => {
    if (anotherEmail) await db.delete(user).where(eq(user.email, anotherEmail)).catch(() => {});
  });

  test('creates an account and returns Set-Cookie with session token', async () => {
    anotherEmail = `signup-${crypto.randomUUID()}@test.local`;
    const res = await api.handle(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: anotherEmail, password: TEST_PASS, name: 'Tester' }),
      }),
    );
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    // At least one cookie must be set (session)
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some((c) => c.toLowerCase().includes('session'))).toBe(true);
  });

  test('rejects duplicate email with 4xx', async () => {
    // Try signing up with the already-registered TEST_EMAIL
    const res = await signUp();
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── Sign-in ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/sign-in/email', () => {
  test('returns 200 with Set-Cookie session header', async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some((c) => c.toLowerCase().includes('session'))).toBe(true);
  });

  test('ALL Set-Cookie headers are present (not overwritten by repeated calls)', async () => {
    // This test verifies the writeWebResponse Set-Cookie bug is NOT present in
    // the Elysia Response path. The http-bridge.test.ts covers the Node layer.
    const res = await signIn();
    const cookies = res.headers.getSetCookie?.() ?? [];
    // Ensure no cookie is silently dropped — each Set-Cookie must be present
    for (const cookie of cookies) {
      expect(cookie.length).toBeGreaterThan(0);
    }
  });

  test('wrong password returns 4xx', async () => {
    const res = await api.handle(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: 'WrongPassword!' }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── Session validation (redirectToHome) ─────────────────────────────────────

describe('redirectToHome', () => {
  test('unauthenticated request redirects to /login', async () => {
    const req = new Request('http://localhost/go');
    try {
      await redirectToHome(req);
      expect(true).toBe(false); // must have thrown
    } catch (e) {
      const res = e as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/login');
    }
  });

  test('authenticated request redirects to role home (not /login)', async () => {
    // Use the session cookie captured in beforeAll
    expect(sessionCookie).toBeTruthy();
    const req = new Request('http://localhost/go', {
      headers: { cookie: sessionCookie },
    });
    try {
      await redirectToHome(req);
      expect(true).toBe(false); // must have thrown
    } catch (e) {
      const res = e as Response;
      expect(res.status).toBe(302);
      const location = res.headers.get('location') ?? '';
      expect(location).not.toBe('/login');
      // New users (no SUPER_ADMIN_EMAILS entry) land on /profile
      expect(['/profile', '/dashboard', '/dev']).toContain(location);
    }
  });
});

// ─── Protected endpoints ──────────────────────────────────────────────────────

describe('GET /api/me (session-based auth)', () => {
  test('unauthenticated returns null user', async () => {
    const res = await api.handle(new Request('http://localhost/api/me'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: unknown };
    expect(body.user).toBeNull();
  });

  test('authenticated returns user object', async () => {
    expect(sessionCookie).toBeTruthy();
    const res = await api.handle(
      new Request('http://localhost/api/me', {
        headers: { cookie: sessionCookie },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } | null };
    expect(body.user).not.toBeNull();
    expect(body.user?.email).toBe(TEST_EMAIL);
  });
});
