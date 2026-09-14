/**
 * One JSON error shape for every /api failure, so clients (and the console UI)
 * can rely on `{ error, code, status, requestId }`:
 *  - 404 for unknown routes/methods instead of Elysia's bare "NOT_FOUND" text
 *  - 422 validation errors flattened into readable `issues` (no schema dump)
 *  - 500s logged once with a request id that is also returned to the caller;
 *    internal messages/stacks never leave the process in production.
 * Thrown `Response`s (guard redirects) and errors carrying an HTTP status
 * (Better Auth's APIError) pass through with their own status.
 */
import { Elysia } from 'elysia';
import { isProd } from './env';
import { logger } from './logger';

export type ApiErrorBody = {
  error: string;
  code: string;
  status: number;
  requestId: string;
  method?: string;
  path?: string;
  issues?: Array<{ path: string; message: string }>;
};

const MESSAGES = {
  NOT_FOUND: 'Endpoint tidak ditemukan',
  VALIDATION: 'Validasi gagal',
  PARSE: 'Body request tidak bisa dibaca',
  INVALID_COOKIE_SIGNATURE: 'Cookie tidak valid',
  INTERNAL: 'Terjadi kesalahan di server. Coba lagi; sertakan requestId bila melapor.',
} as const;

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION: 422,
  PARSE: 400,
  INVALID_COOKIE_SIGNATURE: 401,
  INVALID_FILE_TYPE: 415,
};

type ValidationLike = {
  type?: string;
  all?: Array<{ path?: string; message?: string; summary?: string }>;
};
type StatusLike = { statusCode?: unknown; status?: unknown; message?: unknown };

export const newRequestId = () => crypto.randomUUID().slice(0, 12);

function jsonError(body: ApiErrorBody): Response {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-request-id': body.requestId,
    },
  });
}

/** HTTP status carried by the error itself (Better Auth APIError.statusCode, custom errors). */
function carriedStatus(error: unknown): number | null {
  const e = error as StatusLike;
  const n = typeof e?.statusCode === 'number' ? e.statusCode : e?.status;
  return typeof n === 'number' && n >= 400 && n <= 599 ? n : null;
}

/** JSON 404 for paths nothing serves (used where Elysia's router is bypassed, e.g. behind a mount). */
export function notFoundResponse(request: Request): Response {
  return jsonError({
    error: MESSAGES.NOT_FOUND,
    code: 'NOT_FOUND',
    status: 404,
    requestId: newRequestId(),
    method: request.method,
    path: new URL(request.url).pathname,
  });
}

export function apiErrorPlugin(opts: { exposeDetails?: boolean } = {}) {
  const expose = opts.exposeDetails ?? !isProd;
  return new Elysia({ name: 'api-error' }).onError({ as: 'global' }, ({ code, error, request }) => {
    if (error instanceof Response) return error;
    const requestId = newRequestId();
    const url = new URL(request.url);
    const base = { requestId, method: request.method, path: url.pathname };
    const codeName = String(code);

    if (codeName === 'VALIDATION') {
      const v = error as ValidationLike;
      const issues = (v.all ?? [])
        .filter((i) => i.path !== undefined || i.message)
        .map((i) => ({ path: i.path || v.type || '', message: i.summary ?? i.message ?? '' }));
      return jsonError({
        error: MESSAGES.VALIDATION,
        code: 'VALIDATION',
        status: 422,
        ...base,
        issues,
      });
    }
    if (codeName in STATUS_BY_CODE) {
      const status = STATUS_BY_CODE[codeName];
      const msg = MESSAGES[codeName as keyof typeof MESSAGES] ?? String((error as Error).message);
      return jsonError({ error: msg, code: codeName, status, ...base });
    }
    const carried = carriedStatus(error);
    if (carried && carried < 500) {
      const msg = String((error as StatusLike).message ?? MESSAGES.INTERNAL);
      return jsonError({
        error: msg,
        code: codeName === 'UNKNOWN' ? 'ERROR' : codeName,
        status: carried,
        ...base,
      });
    }
    const status = carried ?? 500;
    logger.error(
      { err: error, requestId, method: request.method, path: url.pathname },
      'API error',
    );
    const message = expose && error instanceof Error ? error.message : MESSAGES.INTERNAL;
    return jsonError({ error: message, code: 'INTERNAL', status, ...base });
  });
}
