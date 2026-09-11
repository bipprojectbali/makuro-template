import { describe, expect, test } from 'bun:test';
import {
  canAccessDev,
  canActOnTarget,
  canImpersonate,
  canSetRole,
  homeFor,
  isAdminRole,
  isAssignableRole,
  isSuperAdminEmail,
  normalizeRole,
  ROLES,
  reconcileRole,
} from '../server/permissions';

const envSet = (...emails: string[]) => new Set(emails.map((e) => e.toLowerCase()));

describe('normalizeRole', () => {
  test('keeps known roles', () => {
    expect(normalizeRole('admin')).toBe(ROLES.ADMIN);
    expect(normalizeRole('super-admin')).toBe(ROLES.SUPER_ADMIN);
  });
  test('defaults unknown/null to user', () => {
    expect(normalizeRole(null)).toBe(ROLES.USER);
    expect(normalizeRole('editor')).toBe(ROLES.USER);
    expect(normalizeRole(undefined)).toBe(ROLES.USER);
  });
});

describe('isAdminRole / canAccessDev', () => {
  test('admin and super-admin are admin roles', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('super-admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
  });
  test('/dev access mirrors admin roles', () => {
    expect(canAccessDev('user')).toBe(false);
    expect(canAccessDev('admin')).toBe(true);
    expect(canAccessDev('super-admin')).toBe(true);
  });
});

describe('isSuperAdminEmail', () => {
  const set = envSet('boss@acme.com');
  test('matches case-insensitively and trims', () => {
    expect(isSuperAdminEmail('boss@acme.com', set)).toBe(true);
    expect(isSuperAdminEmail('  BOSS@ACME.COM ', set)).toBe(true);
    expect(isSuperAdminEmail('other@acme.com', set)).toBe(false);
  });
});

describe('reconcileRole', () => {
  const set = envSet('boss@acme.com');
  test('email in env is always super-admin', () => {
    expect(reconcileRole('boss@acme.com', 'user', set)).toBe(ROLES.SUPER_ADMIN);
    expect(reconcileRole('boss@acme.com', null, set)).toBe(ROLES.SUPER_ADMIN);
  });
  test('removed super-admin demotes to user', () => {
    expect(reconcileRole('ex@acme.com', 'super-admin', set)).toBe(ROLES.USER);
  });
  test('keeps admin/user when not in env', () => {
    expect(reconcileRole('a@acme.com', 'admin', set)).toBe(ROLES.ADMIN);
    expect(reconcileRole('u@acme.com', 'user', set)).toBe(ROLES.USER);
    expect(reconcileRole('u@acme.com', null, set)).toBe(ROLES.USER);
  });
});

describe('canSetRole / canImpersonate', () => {
  test('super-admin only', () => {
    expect(canSetRole('super-admin')).toBe(true);
    expect(canSetRole('admin')).toBe(false);
    expect(canSetRole('user')).toBe(false);
    expect(canImpersonate('super-admin')).toBe(true);
    expect(canImpersonate('admin')).toBe(false);
  });
});

describe('canActOnTarget', () => {
  test('super-admin acts on anyone', () => {
    expect(canActOnTarget('super-admin', 'admin')).toBe(true);
    expect(canActOnTarget('super-admin', 'super-admin')).toBe(true);
    expect(canActOnTarget('super-admin', 'user')).toBe(true);
  });
  test('admin acts only on regular users', () => {
    expect(canActOnTarget('admin', 'user')).toBe(true);
    expect(canActOnTarget('admin', 'admin')).toBe(false);
    expect(canActOnTarget('admin', 'super-admin')).toBe(false);
  });
  test('user acts on no one', () => {
    expect(canActOnTarget('user', 'user')).toBe(false);
  });
});

describe('homeFor', () => {
  test('each role maps to its own area', () => {
    expect(homeFor('user')).toBe('/profile');
    expect(homeFor('admin')).toBe('/dashboard');
    expect(homeFor('super-admin')).toBe('/dev');
  });
  test('unknown/null defaults to the user area', () => {
    expect(homeFor(null)).toBe('/profile');
    expect(homeFor('editor')).toBe('/profile');
  });
});

describe('isAssignableRole', () => {
  test('only user and admin are assignable via UI', () => {
    expect(isAssignableRole('user')).toBe(true);
    expect(isAssignableRole('admin')).toBe(true);
    expect(isAssignableRole('super-admin')).toBe(false);
    expect(isAssignableRole('editor')).toBe(false);
  });
});
