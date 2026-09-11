/**
 * Development server: a single port serving BOTH the Elysia API and the
 * React Router SSR app with Vite HMR.
 *
 * We use a real Node http server (Bun implements node:http) so Vite's
 * connect-style middleware gets genuine req/res objects:
 *  - `/api/*`  -> Elysia (via web Request/Response bridge)
 *  - assets/HMR -> Vite middleware
 *  - everything else -> React Router SSR handler (loaded via Vite, HMR-aware)
 */
import { createServer } from 'node:http';
import { createRequestHandler } from 'react-router';
import { createServer as createViteServer } from 'vite';
import { api } from './api';
import { env } from './env';
import { nodeToWebRequest, writeWebResponse } from './http-bridge';
import { logger } from './logger';
import { recordVisit } from './middleware/visitor';

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

const server = createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];

  // API + auth -> Elysia.
  if (pathname.startsWith('/api')) {
    (async () => {
      try {
        const request = await nodeToWebRequest(req);
        const response = await api.handle(request);
        await writeWebResponse(res, response);
      } catch (err) {
        logger.error(err, 'API error');
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    })();
    return;
  }

  // Assets + HMR via Vite, then fall through to React Router SSR.
  vite.middlewares(req, res, async () => {
    try {
      const build = await vite.ssrLoadModule('virtual:react-router/server-build');
      const handler = createRequestHandler(build as never, 'development');
      const request = await nodeToWebRequest(req);
      // Extract IP from Node socket; normalize IPv6-mapped IPv4 (::ffff:x.x.x.x → x.x.x.x).
      const rawIp = req.socket.remoteAddress ?? null;
      const ip = rawIp?.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
      void recordVisit(request, ip);
      const response = await handler(request);
      await writeWebResponse(res, response);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      logger.error(err, 'SSR error');
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
});

server.listen(env.PORT, () => {
  logger.info(`\u{1F680} Makuro dev server on http://localhost:${env.PORT}`);
});
