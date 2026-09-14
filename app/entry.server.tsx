import { PassThrough } from 'node:stream';
import { createReadableStreamFromReadable } from '@react-router/node';
import { processLog } from '@server/ssr-log';
import { isbot } from 'isbot';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
// Import the Node build explicitly: under Bun, bare `react-dom/server`
// resolves to the web-streams build which lacks renderToPipeableStream.
import { renderToPipeableStream } from 'react-dom/server.node';
import {
  type EntryContext,
  type HandleErrorFunction,
  isRouteErrorResponse,
  ServerRouter,
} from 'react-router';

const ABORT_DELAY = 10_000;

/**
 * Server-side route errors: 404s are expected traffic (bots, typos) and get
 * their page without a log line; everything else is logged once through pino
 * with the path, so it also shows up in /dev/server-logs and the MCP log tools.
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  if (isRouteErrorResponse(error) && error.status === 404) return;
  const path = new URL(request.url).pathname;
  if (isRouteErrorResponse(error)) {
    processLog('warn', { status: error.status, path }, 'route error response');
    return;
  }
  processLog('error', { err: error, path, method: request.method }, 'SSR route error');
};

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let status = responseStatusCode;
    const userAgent = request.headers.get('user-agent');

    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || (routerContext as { isSpaMode?: boolean }).isSpaMode
        ? 'onAllReady'
        : 'onShellReady';

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set('Content-Type', 'text/html');
          resolve(new Response(stream, { headers: responseHeaders, status }));
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          status = 500;
          // Shell already streamed: the boundary renders inline; keep the log line.
          if (shellRendered)
            processLog(
              'error',
              { err: error, path: new URL(request.url).pathname },
              'SSR stream error',
            );
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
