import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  // Post-auth resolver: sends a logged-in user to their role's home.
  route('go', 'routes/go.tsx'),
  // Strict per-role areas. Each layout guards its role; children inherit it.
  layout('routes/user/layout.tsx', [route('profile', 'routes/user/profile.tsx')]),
  layout('routes/admin/layout.tsx', [route('dashboard', 'routes/admin/dashboard.tsx')]),
  layout('routes/super/layout.tsx', [route('dev', 'routes/super/dev.tsx')]),
] satisfies RouteConfig;
