import { describe, expect, it } from 'bun:test';
import {
  buildSessionQuery,
  DEFAULT_SESSION_FILTERS,
  hasActiveSessionFilters,
  isExpired,
} from '../app/lib/sessions-api';

describe('sessions-api helpers', () => {
  it('buildSessionQuery omits defaults (status=active is the default)', () => {
    expect(buildSessionQuery({ ...DEFAULT_SESSION_FILTERS, page: 1, limit: 25 }).toString()).toBe(
      'page=1&limit=25',
    );
    const q = buildSessionQuery({
      ...DEFAULT_SESSION_FILTERS,
      status: 'all',
      impersonated: true,
      userId: 'u',
    });
    expect(q.get('status')).toBe('all');
    expect(q.get('impersonated')).toBe('true');
    expect(q.get('userId')).toBe('u');
  });
  it('hasActiveSessionFilters / isExpired', () => {
    expect(hasActiveSessionFilters(DEFAULT_SESSION_FILTERS)).toBe(false);
    expect(hasActiveSessionFilters({ ...DEFAULT_SESSION_FILTERS, status: 'expired' })).toBe(true);
    const now = Date.parse('2026-09-13T00:00:00Z');
    expect(isExpired({ expiresAt: '2026-09-12T23:59:59Z' }, now)).toBe(true);
    expect(isExpired({ expiresAt: '2026-09-14T00:00:00Z' }, now)).toBe(false);
  });
});
