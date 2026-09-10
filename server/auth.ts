import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, multiSession } from 'better-auth/plugins';
import { db } from './db';
import * as schema from './db/schema';
import { env, hasGoogleAuth } from './env';
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
  emailAndPassword: {
    enabled: true,
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
