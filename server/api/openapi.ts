/**
 * GET /api/openapi.json — OpenAPI 3 spec for API-key callers (AI agents, scripts).
 * Generated from the routes' own `t.Object` validation; each operation carries the
 * scope it needs (`x-required-scope`, from scopes.ts) and the spec only lists what
 * the calling key may actually call.
 */
import { toOpenAPISchema } from '@elysia/openapi';
import { type AnyElysia, Elysia } from 'elysia';
import { type ApiKeyIdentity, getApiKeyIdentity } from '../api-keys/identity';
import { isPublicRead, requiredScope, roleAllowsScope } from '../api-keys/scopes';
import { APP_NAME, APP_VERSION } from '../app-info';
import { env } from '../env';

export const OPENAPI_PATH = '/api/openapi.json';

const METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options']);
const SECURITY = [{ apiKeyHeader: [] }, { bearer: [] }];

type BaseSpec = ReturnType<typeof toOpenAPISchema>;
type Operation = Record<string, unknown>;

// MCP is JSON-RPC (its tools are listed through the MCP protocol itself), not REST.
const excluded = (path: string) => path === OPENAPI_PATH || path.startsWith('/api/mcp');

/** Spec limited to the operations `key` can call: public reads plus scopes it holds and its owner's role allows. */
export function specForKey(base: BaseSpec, key: Pick<ApiKeyIdentity, 'scopes' | 'role'>) {
  const paths: Record<string, Record<string, Operation>> = {};
  for (const [path, item] of Object.entries(base.paths)) {
    if (!item || excluded(path)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      const scope = requiredScope(method, path);
      const isPublic = isPublicRead(method, path);
      const allowed = scope
        ? key.scopes.includes(scope) && roleAllowsScope(key.role, scope)
        : isPublic;
      if (!allowed) continue;
      paths[path] ??= {};
      paths[path][method] = {
        ...(op as Operation),
        tags: [path.split('/')[2] ?? 'api'],
        'x-required-scope': scope,
        security: scope ? SECURITY : [],
      };
    }
  }
  return {
    openapi: '3.0.3',
    info: {
      title: `${APP_NAME} API`,
      version: APP_VERSION,
      description:
        'Hanya berisi endpoint yang bisa dipanggil API key ini. Scope tiap operasi ada di `x-required-scope`. Error selalu JSON { error, code, status, requestId }.',
    },
    servers: [{ url: env.APP_URL.replace(/\/$/, '') }],
    security: SECURITY,
    components: {
      ...base.components,
      securitySchemes: {
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'mk_live_…' },
      },
    },
    paths,
  };
}

/** Takes a getter so the route can describe the router it is registered on. */
export function openapiApi(getApp: () => AnyElysia) {
  let base: BaseSpec | null = null;
  return new Elysia().get('/openapi.json', ({ request, status }) => {
    const key = getApiKeyIdentity(request);
    if (!key)
      return status(401, {
        error:
          'Spec OpenAPI butuh API key. Kirim header X-API-Key: mk_live_… atau Authorization: Bearer mk_live_….',
        code: 'API_KEY_REQUIRED',
      });
    // Routes are fixed once the server has booted, so the generated base is built once.
    base ??= toOpenAPISchema(getApp());
    return specForKey(base, key);
  });
}
