import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

/**
 * Role model for this app. `super-admin` is controlled exclusively by the
 * SUPER_ADMIN_EMAILS env (see reconcileRole); `admin` is granted by a
 * super-admin through the /dev UI; `user` is the default.
 */
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super-admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles a super-admin may assign via the UI. super-admin is env-only. */
export const ASSIGNABLE_ROLES: Role[] = [ROLES.USER, ROLES.ADMIN];

function isRole(value: unknown): value is Role {
  return value === ROLES.USER || value === ROLES.ADMIN || value === ROLES.SUPER_ADMIN;
}

/** Coerce a stored role (possibly null/legacy) to a known Role, defaulting to user. */
export function normalizeRole(role: unknown): Role {
  return isRole(role) ? role : ROLES.USER;
}

export function isAdminRole(role: unknown): boolean {
  const r = normalizeRole(role);
  return r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN;
}

/** /dev access: admin and super-admin only. */
export function canAccessDev(role: unknown): boolean {
  return isAdminRole(role);
}

/**
 * Single source of truth for each role's home area. Strict isolation: a role
 * may only see its own area, so cross-area guards redirect here.
 *   user -> /profile, admin -> /dashboard, super-admin -> /dev
 */
export function homeFor(role: unknown): string {
  const r = normalizeRole(role);
  if (r === ROLES.SUPER_ADMIN) return '/dev';
  if (r === ROLES.ADMIN) return '/dashboard';
  return '/profile';
}

export function isSuperAdminEmail(email: string, superAdminEmails: ReadonlySet<string>): boolean {
  return superAdminEmails.has(email.trim().toLowerCase());
}

/**
 * Desired role given env membership and the currently stored role. env is the
 * single source of truth for super-admin:
 *  - email in env            -> super-admin
 *  - email gone but was super-> demote to user
 *  - otherwise               -> keep stored role (user/admin via UI)
 */
export function reconcileRole(
  email: string,
  currentRole: unknown,
  superAdminEmails: ReadonlySet<string>,
): Role {
  if (isSuperAdminEmail(email, superAdminEmails)) return ROLES.SUPER_ADMIN;
  const current = normalizeRole(currentRole);
  if (current === ROLES.SUPER_ADMIN) return ROLES.USER;
  return current;
}

/** Only super-admin may change roles. */
export function canSetRole(actorRole: unknown): boolean {
  return normalizeRole(actorRole) === ROLES.SUPER_ADMIN;
}

/** super-admin acts on anyone; admin acts only on non-admin (regular) users. */
export function canActOnTarget(actorRole: unknown, targetRole: unknown): boolean {
  const actor = normalizeRole(actorRole);
  if (actor === ROLES.SUPER_ADMIN) return true;
  if (actor === ROLES.ADMIN) return !isAdminRole(targetRole);
  return false;
}

/** Only super-admin may impersonate. */
export function canImpersonate(actorRole: unknown): boolean {
  return normalizeRole(actorRole) === ROLES.SUPER_ADMIN;
}

export function isAssignableRole(role: unknown): role is Role {
  return isRole(role) && ASSIGNABLE_ROLES.includes(role);
}

// --- Better Auth access control ------------------------------------------
// Statement mirrors Better Auth's admin defaults so role permissions line up
// with the plugin's own endpoint guards.
const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

export const roles = {
  [ROLES.USER]: ac.newRole({}),
  [ROLES.ADMIN]: ac.newRole({ user: ['list', 'ban'], session: ['list'] }),
  [ROLES.SUPER_ADMIN]: ac.newRole({
    ...adminAc.statements,
    user: [...adminAc.statements.user, 'impersonate-admins'],
  }),
};
