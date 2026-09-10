import { requireAnyRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiGrid, FiHome, FiUser } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Admin — Makuro' }];
}

const NAV: NavItem[] = [{ to: '/dashboard', label: 'Dashboard', icon: FiHome }];
const PROFILE: NavItem = { to: '/profile', label: 'Profile', icon: FiUser };

const SECONDARY: Record<string, NavItem[]> = {
  admin: [PROFILE],
  'super-admin': [{ to: '/dev', label: 'Dev Console', icon: FiGrid }, PROFILE],
};

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAnyRole(request, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
  return { ...auth, collapsed: getSidebarCollapsed(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={SECONDARY[loaderData.role]}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor="blue"
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
