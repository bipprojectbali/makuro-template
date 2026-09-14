// API keys (Better Auth apiKey plugin table + our extra columns) and per-request usage log.
import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.auth';

// Column set required by @better-auth/api-key (model "apikey"); do not rename.
// Extra columns after `metadata` are ours (rotation, IP allow-list, last origin).
export const apikey = pgTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').default('default').notNull(),
    name: text('name'),
    start: text('start'),
    prefix: text('prefix'),
    key: text('key').notNull(),
    referenceId: text('reference_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    lastRefillAt: timestamp('last_refill_at'),
    enabled: boolean('enabled').default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window').default(86_400_000),
    rateLimitMax: integer('rate_limit_max').default(10),
    requestCount: integer('request_count').default(0),
    remaining: integer('remaining'),
    lastRequest: timestamp('last_request'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    /** JSON string: { scope: string[] } (plugin permissions format). */
    permissions: text('permissions'),
    metadata: text('metadata'),
    /** Key this one replaced during rotation. */
    rotatedFromId: text('rotated_from_id'),
    /** Newline-separated IPs/CIDR prefixes allowed to use the key; NULL = any. */
    allowedIps: text('allowed_ips'),
    note: text('note'),
    lastIp: text('last_ip'),
    lastCountry: text('last_country'),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => [
    index('apikey_reference_id_idx').on(t.referenceId),
    index('apikey_key_idx').on(t.key),
    index('apikey_expires_at_idx').on(t.expiresAt),
  ],
);

// One row per authenticated API-key request (written in batches).
export const apiKeyUsage = pgTable(
  'api_key_usage',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    keyId: text('key_id')
      .notNull()
      .references(() => apikey.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    path: text('path').notNull(),
    status: integer('status').notNull(),
    ip: text('ip'),
    country: text('country'),
    userAgent: text('user_agent'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('api_key_usage_key_id_created_at_idx').on(t.keyId, t.createdAt),
    index('api_key_usage_created_at_idx').on(t.createdAt),
  ],
);
