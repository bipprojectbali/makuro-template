import type { auth } from '@server/auth';
import type { Role } from '@server/permissions';
import { useOutletContext } from 'react-router';

export type AppUser = (typeof auth)['$Infer']['Session']['user'];

/** Shared by every area layout to its child page via <Outlet context>. */
export type AppContext = { user: AppUser; role: Role };

export function useApp() {
  return useOutletContext<AppContext>();
}
