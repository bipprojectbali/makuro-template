import { requireAnyRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiGrid, FiHome, FiUser } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Makuro' }];
}

const NAV: NavItem[] = [{ to: '/profile', label: 'Profile', icon: FiUser }];

const SECONDARY_NAV: Record<string, NavItem[]> = {
  admin: [{ to: '/dashboard', label: 'Dashboard', icon: FiHome }],
  'super-admin': [
    { to: '/dev', label: 'Dev Console', icon: FiGrid },
    { to: '/dashboard', label: 'Dashboard', icon: FiHome },
  ],
};

const BADGE_COLOR: Record<string, string> = {
  user: 'gray',
  admin: 'blue',
  'super-admin': 'grape',
};

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAnyRole(request, [ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN]);
  return { ...auth, collapsed: getSidebarCollapsed(request) };
}

export default function UserLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={SECONDARY_NAV[loaderData.role]}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor={BADGE_COLOR[loaderData.role] ?? 'gray'}
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
