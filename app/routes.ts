import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  // Post-auth resolver: sends a logged-in user to their role's home.
  route('go', 'routes/go.tsx'),
  // Strict per-role areas. Each layout guards its role; children inherit it.
  layout('routes/user/layout.tsx', [route('profile', 'routes/user/profile.tsx')]),
  layout('routes/admin/layout.tsx', [route('dashboard', 'routes/admin/dashboard.tsx')]),
  layout('routes/super/layout.tsx', [
    route('dev', 'routes/super/dev.tsx'),
    route('dev/db-schema', 'routes/super/db-schema.tsx'),
    route('dev/visits', 'routes/super/visits.tsx'),
    route('dev/login-logs', 'routes/super/login-logs.tsx'),
    route('dev/rate-limit-logs', 'routes/super/rate-limit-logs.tsx'),
    route('dev/settings', 'routes/super/settings.tsx'),
  ]),
] satisfies RouteConfig;
