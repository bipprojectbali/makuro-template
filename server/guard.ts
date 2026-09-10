import { redirect } from 'react-router';
import { auth } from './auth';
import { homeFor, type Role } from './permissions';
import { resolveUserRole } from './roles';

/**
 * Layout guard for strict per-role areas. Enforces an authenticated session and
 * that the resolved role matches the area. A logged-in user hitting the wrong
 * area is bounced to their own home (see homeFor); anonymous users go to /login.
 * Returns the session user + resolved role for the area to render.
 */
export async function requireRole(request: Request, required: Role) {
  return requireAnyRole(request, [required]);
}

/**
 * Like requireRole but accepts any role in `allowed`. Used where a higher role
 * is a superset of a lower one — e.g. super-admin may enter the admin area.
 */
export async function requireAnyRole(request: Request, allowed: readonly Role[]) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect('/login');
  const role = await resolveUserRole(session.user);
  if (!allowed.includes(role)) throw redirect(homeFor(role));
  return { user: session.user, role };
}

/**
 * Post-auth resolver used by /go: send an authenticated user to their role's
 * home. Role is unknown at OAuth callback time, so login funnels through here.
 */
export async function redirectToHome(request: Request): Promise<never> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect('/login');
  const role = await resolveUserRole(session.user);
  throw redirect(homeFor(role));
}
