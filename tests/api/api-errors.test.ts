/** Uniform JSON errors for /api: 404, 422 issues, 500 with request id, pass-through of Responses and status-bearing errors. */
import { describe, expect, test } from 'bun:test';
import { Elysia, t } from 'elysia';
import { api } from '../../server/api';
import { apiErrorPlugin } from '../../server/api-error';

class ApiLikeError extends Error {
  statusCode = 409;
}
const app = new Elysia({ prefix: '/api' })
  .use(apiErrorPlugin({ exposeDetails: false }))
  .get('/ok', () => ({ ok: true }))
  .post('/v', ({ body }) => body, {
    body: t.Object({ n: t.Integer(), name: t.String({ minLength: 2 }) }),
  })
  .get('/boom', () => {
    throw new Error('internal secret detail');
  })
  .get('/conflict', () => {
    throw new ApiLikeError('Sudah ada');
  })
  .get('/redirect', () => {
    throw new Response(null, { status: 302, headers: { location: '/login' } });
  });

async function call(path: string, init?: RequestInit) {
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  return { res, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

describe('apiErrorPlugin', () => {
  test('unknown route → 404 JSON with method, path and request id', async () => {
    const { res, body } = await call('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body?.code).toBe('NOT_FOUND');
    expect(body?.path).toBe('/api/nope');
    expect(body?.method).toBe('GET');
    expect(res.headers.get('x-request-id')).toBe(body?.requestId as string);
  });
  test('validation → 422 with readable issues, no schema dump', async () => {
    const { res, body } = await call('/api/v', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ n: 'x', name: 'a' }),
    });
    expect(res.status).toBe(422);
    expect(body?.code).toBe('VALIDATION');
    const issues = body?.issues as Array<{ path: string; message: string }>;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path.includes('n'))).toBe(true);
    expect(JSON.stringify(body)).not.toContain('"type":"object"');
  });
  test('unhandled error → 500 with request id and a generic message when details are hidden', async () => {
    const { res, body } = await call('/api/boom');
    expect(res.status).toBe(500);
    expect(body?.code).toBe('INTERNAL');
    expect(String(body?.error)).not.toContain('secret');
    expect(String(body?.requestId).length).toBeGreaterThan(6);
  });
  test('errors carrying a status and thrown Responses keep their status', async () => {
    const conflict = await call('/api/conflict');
    expect(conflict.res.status).toBe(409);
    expect(conflict.body?.error).toBe('Sudah ada');
    const redirect = await app.handle(new Request('http://localhost/api/redirect'));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/login');
    expect((await call('/api/ok')).res.status).toBe(200);
  });
  test('the real API app answers unknown routes with the same JSON shape', async () => {
    const res = await api.handle(new Request('http://localhost/api/does-not-exist'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; requestId: string };
    expect(body.code).toBe('NOT_FOUND');
    expect(body.requestId).toBeTruthy();
  });
});
