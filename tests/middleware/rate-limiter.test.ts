import { describe, expect, it } from 'bun:test';
import { checkRateLimit } from '../../server/middleware/rate-limiter';

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const ip = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(ip, { windowMs: 60_000, limit: 10 });
      expect(result.limited).toBe(false);
      expect(result.remaining).toBeGreaterThan(0);
    }
  });

  it('blocks after limit is exceeded', () => {
    const ip = `test-ip-${Math.random()}`;
    const config = { windowMs: 60_000, limit: 3 };
    // First 3 requests are OK.
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(ip, config).limited).toBe(false);
    }
    // 4th exceeds the limit.
    expect(checkRateLimit(ip, config).limited).toBe(true);
  });

  it('counts independently per IP', () => {
    const ip1 = `test-ip-${Math.random()}`;
    const ip2 = `test-ip-${Math.random()}`;
    const config = { windowMs: 60_000, limit: 2 };
    checkRateLimit(ip1, config);
    checkRateLimit(ip1, config);
    checkRateLimit(ip1, config); // ip1 is limited
    // ip2 should still be allowed.
    expect(checkRateLimit(ip2, config).limited).toBe(false);
  });

  it('remaining decreases with each request', () => {
    const ip = `test-ip-${Math.random()}`;
    const config = { windowMs: 60_000, limit: 5 };
    const r1 = checkRateLimit(ip, config);
    const r2 = checkRateLimit(ip, config);
    expect(r2.remaining).toBeLessThan(r1.remaining);
  });
});
