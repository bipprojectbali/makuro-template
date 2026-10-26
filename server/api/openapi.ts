/**
 * GET /api/openapi.json — OpenAPI 3 spec for API-key callers (AI agents, scripts).
 * Generated from the routes' own `t.Object` validation; each operation carries the
 * scope it needs (`x-required-scope`, from scopes.ts) and the spec only lists what
 * the calling key may actually call.
 */
import { toOpenAPISchema } from '@elysia/openapi';
import { ScalarRender } from '@elysia/openapi/scalar';
import { type AnyElysia, Elysia } from 'elysia';
import { type ApiKeyIdentity, getApiKeyIdentity } from '../api-keys/identity';
import { isPublicRead, requiredScope, roleAllowsScope, type Scope } from '../api-keys/scopes';
import { APP_NAME, APP_VERSION } from '../app-info';
import { env } from '../env';
import { resolveActor, signedOutTarget } from '../guard';
import { homeFor, ROLES } from '../permissions';

export const OPENAPI_PATH = '/api/openapi.json';
const SCALAR_CDN =
  'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0/dist/browser/standalone.js';
const DOCS_DESCRIPTION = 'Dokumentasi API interaktif. Semua endpoint; coba langsung dari browser.';
const API_TITLE = `${APP_NAME} API`;
const KEY_DESCRIPTION =
  'Hanya berisi endpoint yang bisa dipanggil API key ini. Scope tiap operasi ada di `x-required-scope`. Error selalu JSON { error, code, status, requestId }.';

const METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options']);
const SECURITY = [{ apiKeyHeader: [] }, { bearer: [] }];

type BaseSpec = ReturnType<typeof toOpenAPISchema>;
type Operation = Record<string, unknown>;

// MCP is JSON-RPC (its tools are listed through the MCP protocol itself), not REST.
const excluded = (path: string) => path === OPENAPI_PATH || path.startsWith('/api/mcp');

type AllowFn = (scope: Scope | null, isPublic: boolean) => boolean;

/** Shared spec builder: `allow` decides which operations are included; `description` fills info.description. */
function buildSpec(base: BaseSpec, allow: AllowFn, description: string) {
  const paths: Record<string, Record<string, Operation>> = {};
  for (const [path, item] of Object.entries(base.paths)) {
    if (!item || excluded(path)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      const scope = requiredScope(method, path);
      const isPublic = isPublicRead(method, path);
      if (!allow(scope, isPublic)) continue;
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
    info: { title: API_TITLE, version: APP_VERSION, description },
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

/** Spec limited to the operations `key` can call: public reads plus scopes it holds and its owner's role allows. */
export function specForKey(base: BaseSpec, key: Pick<ApiKeyIdentity, 'scopes' | 'role'>) {
  return buildSpec(
    base,
    (scope, isPublic) =>
      scope ? key.scopes.includes(scope) && roleAllowsScope(key.role, scope) : isPublic,
    KEY_DESCRIPTION,
  );
}

/** Full spec: every operation, for the interactive docs (super-admin only). */
export function fullSpec(base: BaseSpec) {
  return buildSpec(base, () => true, DOCS_DESCRIPTION);
}

/** Takes a getter so the route can describe the router it is registered on. */
export function openapiApi(getApp: () => AnyElysia) {
  // Routes are fixed once the server has booted, so the generated base is built once.
  let base: BaseSpec | null = null;
  const built = () => (base ??= toOpenAPISchema(getApp()));
  return new Elysia()
    .get('/openapi.json', ({ request, status }) => {
      const key = getApiKeyIdentity(request);
      if (!key)
        return status(401, {
          error:
            'Spec OpenAPI butuh API key. Kirim header X-API-Key: mk_live_… atau Authorization: Bearer mk_live_….',
          code: 'API_KEY_REQUIRED',
        });
      return specForKey(built(), key);
    })
    .get('/docs', async ({ request }) => {
      const actor = await resolveActor(request);
      if (!actor)
        return new Response(null, { status: 302, headers: { Location: signedOutTarget(request) } });
      if (actor.role !== ROLES.SUPER_ADMIN)
        return new Response(null, { status: 302, headers: { Location: homeFor(actor.role) } });
      const html = ScalarRender(
        { title: API_TITLE, version: APP_VERSION, description: DOCS_DESCRIPTION },
        { cdn: SCALAR_CDN } as Parameters<typeof ScalarRender>[1],
        JSON.stringify(fullSpec(built())),
      );
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    });
}
