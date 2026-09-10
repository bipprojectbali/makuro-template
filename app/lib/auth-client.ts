import { ac, roles } from '@server/permissions';
import { adminClient, multiSessionClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth browser client. Same-origin, so no baseURL needed; it defaults
 * to the current origin and talks to /api/auth/*.
 */
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), multiSessionClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
