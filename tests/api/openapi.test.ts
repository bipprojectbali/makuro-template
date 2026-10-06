import { describe, expect, test } from 'bun:test';
import { toOpenAPISchema } from '@elysia/openapi';
import Elysia, { t } from 'elysia';
import { OPENAPI_PATH, openapiApi, specForKey } from '../../server/api/openapi';
import { type ApiKeyIdentity, setApiKeyIdentity } from '../../server/api-keys/identity';

// test-only: a small router shaped like the real /api tree.
const routes = new Elysia({ prefix: '/api' })
  .get('/posts/', () => [])
  .post('/posts/', () => ({}), { body: t.Object({ title: t.String() }) })
  .get('/app/whoami', () => ({}))
  .get('/admin/users', () => [])
  .post('/mcp', () => ({}))
  .get('/api-keys', () => [])
  .get('/me/api-keys', () => []);

const base = toOpenAPISchema(routes);

const key = (scopes: string[], role: ApiKeyIdentity['role'] = 'user'): ApiKeyIdentity => ({
  keyId: 'k1',
  keyName: 'test',
  scopes,
  user: { id: 'u1', email: 'agent@example.test', name: 'Agent' },
  role,
  startedAt: Date.now(),
});

const ops = (spec: ReturnType<typeof specForKey>) =>
  Object.entries(spec.paths).flatMap(([p, item]) => Object.keys(item).map((m) => `${m} ${p}`));

describe('specForKey', () => {
  test('lists public reads and scoped ops the key holds, never MCP or key management', () => {
    const spec = specForKey(base, key(['app:read', 'posts:write']));
    expect(ops(spec).sort()).toEqual([
      'get /api/app/whoami',
      'get /api/posts/',
      'post /api/posts/',
    ]);
    expect(spec.paths['/api/posts/'].post['x-required-scope']).toBe('posts:write');
    expect(spec.paths['/api/posts/'].get['x-required-scope']).toBeNull();
    expect(spec.paths['/api/posts/'].get.security).toEqual([]);
    expect(spec.components.securitySchemes.apiKeyHeader).toMatchObject({ name: 'X-API-Key' });
  });

  test('drops scopes the owner role no longer allows', () => {
    expect(ops(specForKey(base, key(['users:read'], 'user')))).not.toContain(
      'get /api/admin/users',
    );
    expect(ops(specForKey(base, key(['users:read'], 'admin')))).toContain('get /api/admin/users');
  });
});

describe(`GET ${OPENAPI_PATH}`, () => {
  const build = (identity: ApiKeyIdentity | null) => {
    const app = new Elysia({ prefix: '/api' }).onRequest(({ request }) => {
      if (identity) setApiKeyIdentity(request, identity);
    });
    return app.use(openapiApi(() => routes));
  };

  test('401 without an API key', async () => {
    const res = await build(null).handle(new Request(`http://localhost${OPENAPI_PATH}`));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('API_KEY_REQUIRED');
  });

  test('returns the filtered spec for a key', async () => {
    const res = await build(key(['app:read'])).handle(
      new Request(`http://localhost${OPENAPI_PATH}`),
    );
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(Object.keys(spec.paths).sort()).toEqual(['/api/app/whoami', '/api/posts/']);
  });
});
