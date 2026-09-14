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
import { newRequestId } from './api-error';
import { env } from './env';
import { errorResponse } from './error-page';
import { nodeToWebRequest, writeWebResponse } from './http-bridge';
import { isHttpProbe, probeResponse } from './http-probes';
import { logger } from './logger';
import { stampClientIp } from './middleware/client-ip';
import { recordVisit } from './middleware/visitor';
import { getBranding } from './settings-branding';
import { maintenanceGate } from './settings-maintenance';

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
        stampClientIp(request, req.socket.remoteAddress);
        const response = await api.handle(request);
        await writeWebResponse(res, response);
      } catch (err) {
        // Bridge-level failure (before Elysia's own error handler could run).
        const requestId = newRequestId();
        logger.error({ err, requestId, path: pathname }, 'API bridge error');
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.setHeader('x-request-id', requestId);
        res.end(
          JSON.stringify({
            error: 'Terjadi kesalahan di server',
            code: 'INTERNAL',
            status: 500,
            requestId,
          }),
        );
      }
    })();
    return;
  }

  // Browser/devtools probes (e.g. Chrome's com.chrome.devtools.json): plain 404,
  // never SSR, never counted as a visit.
  if (isHttpProbe(pathname)) {
    void writeWebResponse(res, probeResponse(pathname));
    return;
  }

  // Assets + HMR via Vite, then fall through to React Router SSR.
  vite.middlewares(req, res, async () => {
    try {
      const build = await vite.ssrLoadModule('virtual:react-router/server-build');
      const handler = createRequestHandler(build as never, 'development');
      const request = await nodeToWebRequest(req);
      stampClientIp(request, req.socket.remoteAddress);
      // Maintenance mode answers before SSR (and is not counted as a visit).
      const blocked = await maintenanceGate(request, (await getBranding()).appName);
      if (blocked) {
        await writeWebResponse(res, blocked);
        return;
      }
      void recordVisit(request);
      const response = await handler(request);
      await writeWebResponse(res, response);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      const requestId = newRequestId();
      logger.error({ err, requestId, path: pathname }, 'SSR error');
      await writeWebResponse(res, errorResponse({ status: 500, requestId }));
    }
  });
});

server.listen(env.PORT, () => {
  logger.info(`\u{1F680} Makuro dev server on http://localhost:${env.PORT}`);
});
