import { describe, expect, it } from 'bun:test';
import {
  buildRateLimitQuery,
  DEFAULT_RATE_LIMIT_FILTERS,
  formatWindow,
  hasActiveRateLimitFilters,
} from '../app/lib/rate-limit-logs-api';

describe('rate-limit-logs-api', () => {
  it('buildRateLimitQuery omits defaults and maps period to days', () => {
    expect(
      buildRateLimitQuery({
        ...DEFAULT_RATE_LIMIT_FILTERS,
        page: 1,
        limit: 25,
        sort: 'desc',
      }).toString(),
    ).toBe('page=1&limit=25&sort=desc');
    const q = buildRateLimitQuery({
      ...DEFAULT_RATE_LIMIT_FILTERS,
      period: '1',
      ip: '1.2.3.4',
      path: '/api/x',
      method: 'GET',
    });
    expect(q.get('days')).toBe('1');
    expect(q.get('ip')).toBe('1.2.3.4');
    expect(q.get('path')).toBe('/api/x');
    expect(q.get('method')).toBe('GET');
  });

  it('hasActiveRateLimitFilters and formatWindow', () => {
    expect(hasActiveRateLimitFilters(DEFAULT_RATE_LIMIT_FILTERS)).toBe(false);
    expect(hasActiveRateLimitFilters({ ...DEFAULT_RATE_LIMIT_FILTERS, ip: '1.1.1.1' })).toBe(true);
    expect(formatWindow(60_000)).toBe('1 menit');
    expect(formatWindow(90_000)).toBe('1,5 menit');
    expect(formatWindow(5_000)).toBe('5 detik');
  });
});
