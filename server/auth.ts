import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, multiSession } from 'better-auth/plugins';
import { AUDIT_ACTIONS, audit } from './audit';
import { db } from './db';
import * as schema from './db/schema';
import { env, hasGoogleAuth } from './env';
import { logger } from './logger';
import { describeClient, loginMethodFromPath } from './middleware/request-meta';
import { normalizeIp } from './middleware/visitor';
import { ac, ROLES, roles } from './permissions';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  plugins: [
    admin({
      ac,
      roles,
      adminRoles: [ROLES.ADMIN, ROLES.SUPER_ADMIN],
      defaultRole: ROLES.USER,
      impersonationSessionDuration: 60 * 60,
    }),
    // Lets a browser stay signed in to several accounts at once and switch
    // between them. Cookie-based, so no extra DB tables/migration.
    multiSession({ maximumSessions: 5 }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session, ctx) => {
          try {
            const headers = ctx?.request?.headers ?? ctx?.headers ?? null;
            const meta = describeClient(headers, session.userAgent ?? null);
            const method = loginMethodFromPath(ctx?.path);
            await db.insert(schema.loginLog).values({
              userId: session.userId,
              ip: normalizeIp(session.ipAddress ?? null),
              userAgent: session.userAgent ?? null,
              method,
              ...meta,
            });
            const impersonatedBy = (session as { impersonatedBy?: string | null }).impersonatedBy;
            if (method === 'impersonation' && impersonatedBy) {
              void audit({
                actor: { id: impersonatedBy },
                headers: headers ? new Headers(headers) : null,
                action: AUDIT_ACTIONS.USER_IMPERSONATE,
                targetType: 'user',
                targetId: session.userId,
                summary: 'Admin masuk sebagai user ini',
              });
            }
          } catch (err) {
            logger.warn({ err, userId: session.userId }, 'failed to write login_log');
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    // Self-service account deletion from /profile. Credential accounts must
    // confirm with their password; the client asks for it before calling.
    deleteUser: { enabled: true },
  },
  socialProviders: hasGoogleAuth
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : undefined,
});

export type Auth = typeof auth;
