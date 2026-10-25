/**
 * Blocks sensitive actions for demo visitors (403 DEMO_RESTRICTED). Derived apps
 * extend `DEMO_BLOCKED` (push at module load) or call `assertNotDemo` in handlers.
 * A demo visitor may pick the `admin` role, so `/api/admin` is listed here: that
 * router guards itself by role alone and would hand every real user's name and
 * email to an anonymous visitor. A derived app that wants its demo admin to see
 * a populated console must scope that data per demo session first — do not
 * loosen this rule. `/dev` needs no entry: it requires super-admin, which the
 * demo can never be (SUPER_ADMIN_EMAILS is the only source of that role).
 */
import { Elysia } from 'elysia';
import { newRequestId } from '../api-error';
import { auth } from '../auth';
import type { Actor } from '../guard';

/** `prefix` matches the exact path or its sub-paths; a trailing `/` matches sub-paths only. */
export type DemoBlockRule = { method?: string; prefix: string; reason?: string };

export const DEMO_BLOCKED: DemoBlockRule[] = [
  { prefix: '/api/admin', reason: 'Konsol admin' },
  { prefix: '/api/me/api-keys', reason: 'API key pribadi' },
  { prefix: '/api/auth/api-key/', reason: 'API key' },
  { prefix: '/api/auth/change-email', reason: 'Mengganti email' },
  { prefix: '/api/auth/change-password', reason: 'Mengganti password' },
  { prefix: '/api/auth/request-password-reset', reason: 'Reset password' },
  { prefix: '/api/auth/reset-password', reason: 'Reset password' },
  { prefix: '/api/auth/send-verification-email', reason: 'Verifikasi email' },
  { prefix: '/api/auth/link-social', reason: 'Menautkan akun sosial' },
  { method: 'POST', prefix: '/api/app/avatar', reason: 'Unggah foto profil' },
  { method: 'DELETE', prefix: '/api/app/avatar', reason: 'Menghapus foto profil' },
];

function matches(rule: DemoBlockRule, method: string, pathname: string): boolean {
  if (rule.method && rule.method.toUpperCase() !== method.toUpperCase()) return false;
  if (rule.prefix.endsWith('/')) return pathname.startsWith(rule.prefix);
  return pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
}

function findDemoBlock(method: string, pathname: string): DemoBlockRule | undefined {
  return DEMO_BLOCKED.find((r) => matches(r, method, pathname));
}

export function isDemoBlocked(method: string, pathname: string): boolean {
  return findDemoBlock(method, pathname) !== undefined;
}

const demoMessage = (reason?: string) =>
  `${reason ?? 'Fitur ini'} tidak tersedia di mode demo. Daftar akun untuk memakainya.`;

/** Handler guard: a 403 body to return via `status(403, …)` when the actor is a demo visitor, else null. */
export function assertNotDemo(
  actor: Pick<Actor, 'isDemo'> | null,
  reason?: string,
): { error: string; code: 'DEMO_RESTRICTED' } | null {
  return actor?.isDemo ? { error: demoMessage(reason), code: 'DEMO_RESTRICTED' } : null;
}

export function demoRestrictPlugin() {
  return (
    new Elysia({ name: 'demo-restrict' })
      // onRequest: route `derive`s run before beforeHandle and the auth mount is a
      // catch-all, so only a request hook reaches every route registered after this.
      .onRequest(async ({ request }) => {
        const url = new URL(request.url);
        const rule = findDemoBlock(request.method, url.pathname);
        if (!rule) return;
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user.isAnonymous) return;
        const requestId = newRequestId();
        const body = {
          error: demoMessage(rule.reason),
          code: 'DEMO_RESTRICTED',
          status: 403,
          requestId,
          method: request.method,
          path: url.pathname,
        };
        return new Response(JSON.stringify(body), {
          status: 403,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'x-request-id': requestId,
          },
        });
      })
  );
}
