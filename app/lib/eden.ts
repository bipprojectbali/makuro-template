import { treaty } from '@elysiajs/eden';
import type { Api } from '@server/api';

/**
 * End-to-end typesafe API client (Eden Treaty). Because FE + BE share one
 * origin, we can use a relative base URL in the browser. On the server we
 * fall back to APP_URL so SSR loaders can call the API too.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_URL ?? 'http://localhost:3000';
}

export const client = treaty<Api>(baseUrl());
