import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { getApiKeyIdentity } from './api-keys/identity';
import { auth } from './auth';
import { db } from './db';
import { user as userTable } from './db/schema';
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
  const actor = await resolveActor(request);
  if (!actor) throw redirect('/login');
  if (!allowed.includes(actor.role)) throw redirect(homeFor(actor.role));
  return actor;
}

type SessionUser = (typeof auth)['$Infer']['Session']['user'];
export type Actor = { user: SessionUser; role: Role; viaApiKey: boolean };

/**
 * Who is calling: an API-key identity (set by the api-key plugin, scope
 * already enforced) or the cookie session. Null when anonymous.
 */
export async function resolveActor(request: Request): Promise<Actor | null> {
  const key = getApiKeyIdentity(request);
  if (key) {
    // Full row so callers (layouts, admin API) see the same shape as a session user.
    const [row] = await db.select().from(userTable).where(eq(userTable.id, key.user.id)).limit(1);
    if (!row) return null;
    return { user: row as unknown as SessionUser, role: key.role, viaApiKey: true };
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  return { user: session.user, role: await resolveUserRole(session.user), viaApiKey: false };
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
