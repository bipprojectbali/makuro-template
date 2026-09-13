import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // The React Router plugin leaves `optimizeDeps.entries` empty (unless
    // future.unstable_optimizeDeps is on), so Vite has nothing to crawl at
    // startup and discovers browser deps lazily, one page at a time. Each new
    // discovery re-bundles the shared chunks and forces a full reload
    // ("optimized dependencies changed. reloading"). Listing every browser
    // dependency here makes the first pre-bundle complete, so dev never reloads
    // mid-session. Add new client-side packages to this list when you install them.
    include: [
      '@dagrejs/dagre',
      '@elysiajs/eden',
      '@mantine/core',
      '@mantine/form',
      '@mantine/hooks',
      '@mantine/modals',
      '@mantine/notifications',
      '@mantine/nprogress',
      '@tanstack/react-query',
      '@xyflow/react',
      'better-auth/client/plugins',
      'better-auth/plugins/access',
      'better-auth/plugins/admin/access',
      'better-auth/react',
      'react-icons/fc',
      'react-icons/fi',
      'react-icons/tb',
      'zustand',
    ],
  },
  ssr: {
    // postgres.js uses Error.captureStackTrace which breaks when Vite bundles it
    // in the SSR module runner context. Keep it as a native Node import.
    external: ['postgres'],
  },
  build: {
    rollupOptions: isSsrBuild
      ? {
          // Required for `bun build --compile` single-file binary: SSR bundle
          // must be one file (no dynamic chunk splits) so it can be embedded via
          // `import x with { type: "file" }` and loaded from a tmpfile at runtime.
          output: { inlineDynamicImports: true },
        }
      : {},
  },
}));
