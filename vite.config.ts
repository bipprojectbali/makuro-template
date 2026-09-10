import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    // postgres.js uses Error.captureStackTrace which breaks when Vite bundles it
    // in the SSR module runner context. Keep it as a native Node import.
    external: ['postgres'],
  },
});
