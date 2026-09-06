/**
 * Production server: single port, no Vite.
 *  - `/api/*`      -> Elysia
 *  - `/assets/*`   -> hashed immutable client assets from build/client
 *  - other files   -> static files from build/client (favicon, etc.)
 *  - everything else -> React Router SSR handler from the compiled server build
 *
 * Run after `bun run build`.
 */
import { createRequestHandler, type ServerBuild } from 'react-router';
import { api } from './api';
import { env } from './env';
import { logger } from './logger';

// Generated at build time by `react-router build`. Path only exists after build,
// so we load it dynamically and cast to the framework's ServerBuild type.
const build = (await import(
  /* @vite-ignore */ '../build/server/index.js'
)) as unknown as ServerBuild;

const handler = createRequestHandler(build, 'production');
const CLIENT_DIR = new URL('../build/client/', import.meta.url).pathname;

const server = Bun.serve({
  port: env.PORT,
  idleTimeout: 60,
  async fetch(request) {
    const url = new URL(request.url);

    // API + auth.
    if (url.pathname.startsWith('/api')) {
      return api.handle(request);
    }

    // Static client assets.
    const filePath = CLIENT_DIR + url.pathname.replace(/^\/+/, '');
    const file = Bun.file(filePath);
    if (url.pathname !== '/' && (await file.exists())) {
      const immutable = url.pathname.startsWith('/assets/');
      return new Response(file, {
        headers: immutable
          ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
          : { 'Cache-Control': 'public, max-age=3600' },
      });
    }

    // SSR.
    return handler(request);
  },
});

logger.info(`\u{1F680} Makuro production server on http://localhost:${server.port}`);
