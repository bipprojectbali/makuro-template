import { describe, expect, it } from 'bun:test';
import {
  isPublicRead,
  requiredScope,
  roleAllowsScope,
  scopesForRole,
} from '../../server/api-keys/scopes';

describe('requiredScope', () => {
  it('maps routes to scopes by prefix and method', () => {
    expect(requiredScope('GET', '/api/analytics/visits')).toBe('analytics:read');
    expect(requiredScope('DELETE', '/api/analytics/visits')).toBe('analytics:write');
    expect(requiredScope('DELETE', '/api/analytics/purge')).toBe('analytics:write');
    expect(requiredScope('GET', '/api/admin/users')).toBe('users:read');
    expect(requiredScope('POST', '/api/admin/users/x/ban')).toBe('users:write');
    expect(requiredScope('GET', '/api/settings')).toBe('settings:read');
    expect(requiredScope('PUT', '/api/settings/rate-limit')).toBe('settings:write');
    expect(requiredScope('POST', '/api/posts')).toBe('posts:write');
    expect(requiredScope('GET', '/api/me/logins')).toBe('me:read');
  });
  it('blocks auth, key management, MCP, resets and unknown routes', () => {
    expect(requiredScope('POST', '/api/auth/sign-in/email')).toBeNull();
    expect(requiredScope('GET', '/api/api-keys')).toBeNull();
    expect(requiredScope('POST', '/api/mcp')).toBeNull();
    expect(requiredScope('POST', '/api/ops/reset/limiter')).toBeNull();
    expect(requiredScope('DELETE', '/api/logs')).toBeNull();
    expect(requiredScope('GET', '/api/posts')).toBeNull();
    expect(isPublicRead('GET', '/api/posts')).toBe(true);
    expect(isPublicRead('POST', '/api/posts')).toBe(false);
  });
});

describe('role ceiling', () => {
  it('never lets a key exceed its owner role', () => {
    expect(roleAllowsScope('user', 'posts:write')).toBe(true);
    expect(roleAllowsScope('user', 'users:read')).toBe(false);
    expect(roleAllowsScope('admin', 'users:write')).toBe(true);
    expect(roleAllowsScope('admin', 'settings:write')).toBe(false);
    expect(roleAllowsScope('super-admin', 'settings:write')).toBe(true);
    expect(scopesForRole('user')).toEqual(['posts:write', 'me:read']);
  });
});
