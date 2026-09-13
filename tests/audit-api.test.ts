import { describe, expect, it } from 'bun:test';
import {
  actionMeta,
  buildAuditQuery,
  DEFAULT_AUDIT_FILTERS,
  hasActiveAuditFilters,
} from '../app/lib/audit-api';

describe('audit-api helpers', () => {
  it('buildAuditQuery and hasActiveAuditFilters', () => {
    expect(buildAuditQuery({ ...DEFAULT_AUDIT_FILTERS, page: 1, limit: 25 }).toString()).toBe(
      'page=1&limit=25',
    );
    const q = buildAuditQuery({
      ...DEFAULT_AUDIT_FILTERS,
      action: 'user.ban',
      targetType: 'user',
      actorId: 'a',
      period: '7',
    });
    expect(q.get('action')).toBe('user.ban');
    expect(q.get('days')).toBe('7');
    expect(hasActiveAuditFilters(DEFAULT_AUDIT_FILTERS)).toBe(false);
    expect(hasActiveAuditFilters({ ...DEFAULT_AUDIT_FILTERS, actorId: 'a' })).toBe(true);
  });
  it('actionMeta labels known actions and falls back to the raw verb', () => {
    expect(actionMeta('user.delete')).toEqual({ label: 'Hapus user', color: 'red' });
    expect(actionMeta('custom.thing').label).toBe('custom.thing');
  });
});
