import { eq } from 'drizzle-orm';
import { db } from './db';
import { user as userTable } from './db/schema';
import { superAdminEmails } from './env';
import { normalizeRole, type Role, reconcileRole } from './permissions';

type ResolvableUser = { id: string; email: string; role?: string | null };

/**
 * Reconcile a user's stored role against SUPER_ADMIN_EMAILS (the source of
 * truth for super-admin) and return the effective role. Writes to the DB only
 * when the role actually changes, so this is cheap to call on the request path.
 */
export async function resolveUserRole(u: ResolvableUser): Promise<Role> {
  const desired = reconcileRole(u.email, u.role, superAdminEmails);
  if (desired !== normalizeRole(u.role)) {
    await db.update(userTable).set({ role: desired }).where(eq(userTable.id, u.id));
  }
  return desired;
}
