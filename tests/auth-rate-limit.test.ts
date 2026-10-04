/** Better Auth's own limiter keys on the stamped client IP (the project's advanced.ipAddress wiring). */
import { describe, expect, test } from 'bun:test';
import { betterAuth } from 'better-auth';
import { describeAuthError } from '../app/lib/auth-errors';
import { auth } from '../server/auth';
import { CLIENT_IP_HEADER } from '../server/middleware/client-ip';

const BASE = 'http://localhost:3000';
// No database: the rate-limit check runs before any handler touches storage.
const limited = betterAuth({
  baseURL: BASE,
  secret: auth.options.secret,
  advanced: auth.options.advanced,
  rateLimit: { enabled: true, storage: 'memory', window: 60, max: 2 },
  logger: { disabled: true },
});

const ok = (ip: string | null, spoof: Record<string, string> = {}) =>
  limited.handler(
    new Request(`${BASE}/api/auth/ok`, {
      headers: { ...spoof, ...(ip ? { [CLIENT_IP_HEADER]: ip } : {}) },
    }),
  );

describe('Better Auth rate limit per stamped client IP', () => {
  test('same IP is limited; a different stamped IP has its own bucket', async () => {
    expect((await ok('203.0.113.21')).status).toBe(200);
    expect((await ok('203.0.113.21')).status).toBe(200);
    const blocked = await ok('203.0.113.21');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('x-retry-after'))).toBeGreaterThan(0);
    expect((await ok('203.0.113.22')).status).toBe(200);
  });

  test('raw X-Forwarded-For / X-Real-IP never pick the bucket', async () => {
    const spoof = (n: number) => ({
      'x-forwarded-for': `198.51.100.${n}`,
      'x-real-ip': `198.51.100.${n}`,
    });
    expect((await ok('203.0.113.31', spoof(1))).status).toBe(200);
    expect((await ok('203.0.113.31', spoof(2))).status).toBe(200);
    expect((await ok('203.0.113.31', spoof(3))).status).toBe(429);
  });

  test('sign-in keeps the stricter default rule and its 429 maps to Indonesian copy', async () => {
    const signIn = () =>
      limited.handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [CLIENT_IP_HEADER]: '203.0.113.41' },
          body: JSON.stringify({ email: 'nobody@test.local', password: 'wrong-password' }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await signIn()).status);
    expect(statuses).not.toContain(429);
    const blocked = await signIn();
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { message?: string };
    expect(describeAuthError({ ...body, status: blocked.status }).message).toContain(
      'Terlalu banyak percobaan',
    );
  });
});
