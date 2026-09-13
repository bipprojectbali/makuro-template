import { describe, expect, it } from 'bun:test';
import {
  buildUserQuery,
  DEFAULT_USER_FILTERS,
  hasActiveUserFilters,
  isBanActive,
} from '../app/lib/admin-users-api';

describe('admin-users-api helpers', () => {
  it('buildUserQuery omits defaults', () => {
    expect(buildUserQuery({ ...DEFAULT_USER_FILTERS, page: 1, limit: 25 }).toString()).toBe(
      'page=1&limit=25',
    );
    const q = buildUserQuery({
      ...DEFAULT_USER_FILTERS,
      role: 'admin',
      status: 'banned',
      period: '7',
      sort: 'name',
      search: ' x ',
    });
    expect(q.get('role')).toBe('admin');
    expect(q.get('status')).toBe('banned');
    expect(q.get('days')).toBe('7');
    expect(q.get('sort')).toBe('name');
    expect(q.get('search')).toBe('x');
  });

  it('hasActiveUserFilters', () => {
    expect(hasActiveUserFilters(DEFAULT_USER_FILTERS)).toBe(false);
    expect(hasActiveUserFilters({ ...DEFAULT_USER_FILTERS, sort: 'lastLogin' })).toBe(true);
  });

  it('isBanActive respects expiry', () => {
    const now = Date.parse('2026-09-13T00:00:00Z');
    expect(isBanActive({ banned: true, banExpires: null }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: '2026-09-14T00:00:00Z' }, now)).toBe(true);
    expect(isBanActive({ banned: true, banExpires: '2026-09-12T00:00:00Z' }, now)).toBe(false);
    expect(isBanActive({ banned: false, banExpires: null }, now)).toBe(false);
  });
});
