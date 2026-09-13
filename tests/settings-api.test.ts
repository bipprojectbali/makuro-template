import { describe, expect, it } from 'bun:test';
import { pickAuth, pickRateLimit, sameRateLimit } from '../app/lib/settings-api';

const base = {
  emailAuthEnabled: true,
  signupEnabled: false,
  rateLimitEnabled: true,
  rateLimitMax: null,
  rateLimitWindowMs: 5000,
  rateLimitExcludePrefixes: ['/api/auth/'],
};

describe('settings-api helpers', () => {
  it('pickAuth / pickRateLimit split the flat settings object', () => {
    expect(pickAuth(base)).toEqual({ emailAuthEnabled: true, signupEnabled: false });
    expect(pickRateLimit(base)).toEqual({
      rateLimitEnabled: true,
      rateLimitMax: null,
      rateLimitWindowMs: 5000,
      rateLimitExcludePrefixes: ['/api/auth/'],
    });
  });

  it('sameRateLimit compares arrays by value', () => {
    const a = pickRateLimit(base);
    expect(sameRateLimit(a, { ...a, rateLimitExcludePrefixes: ['/api/auth/'] })).toBe(true);
    expect(sameRateLimit(a, { ...a, rateLimitExcludePrefixes: null })).toBe(false);
    expect(sameRateLimit(a, { ...a, rateLimitMax: 10 })).toBe(false);
  });
});
