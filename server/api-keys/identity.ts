/** Request-scoped identity resolved from an API key (set by the plugin, read by guards). */
import type { Role } from '../permissions';

export type ApiKeyIdentity = {
  keyId: string;
  keyName: string | null;
  scopes: string[];
  user: { id: string; email: string; name: string; role?: string | null };
  role: Role;
  startedAt: number;
};

const identities = new WeakMap<Request, ApiKeyIdentity>();

export function setApiKeyIdentity(request: Request, identity: ApiKeyIdentity): void {
  identities.set(request, identity);
}

export function getApiKeyIdentity(request: Request): ApiKeyIdentity | null {
  return identities.get(request) ?? null;
}
