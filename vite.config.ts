import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
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
