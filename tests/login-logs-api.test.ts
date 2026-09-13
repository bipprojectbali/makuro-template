import { describe, expect, it } from 'bun:test';
import {
  buildLoginQuery,
  DEFAULT_LOGIN_FILTERS,
  hasActiveLoginFilters,
  methodMeta,
} from '../app/lib/login-logs-api';

describe('login-logs-api', () => {
  it('buildLoginQuery omits defaults and maps period to days', () => {
    const q = buildLoginQuery({ ...DEFAULT_LOGIN_FILTERS, page: 2, limit: 25, sort: 'desc' });
    expect(q.toString()).toBe('page=2&limit=25&sort=desc');
    const q2 = buildLoginQuery({
      ...DEFAULT_LOGIN_FILTERS,
      period: '7',
      method: 'google',
      userId: 'u1',
      search: ' x ',
    });
    expect(q2.get('days')).toBe('7');
    expect(q2.get('method')).toBe('google');
    expect(q2.get('userId')).toBe('u1');
    expect(q2.get('search')).toBe('x');
  });

  it('hasActiveLoginFilters detects non-default values', () => {
    expect(hasActiveLoginFilters(DEFAULT_LOGIN_FILTERS)).toBe(false);
    expect(hasActiveLoginFilters({ ...DEFAULT_LOGIN_FILTERS, userId: 'u' })).toBe(true);
  });

  it('methodMeta labels known methods and falls back for providers', () => {
    expect(methodMeta('email').label).toBe('Email');
    expect(methodMeta('impersonation').color).toBe('orange');
    expect(methodMeta('github').label).toBe('Github');
    expect(methodMeta(null).label).toBe('Tidak diketahui');
  });
});
