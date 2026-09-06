import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth browser client. Same-origin, so no baseURL needed; it defaults
 * to the current origin and talks to /api/auth/*.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
