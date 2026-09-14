// Log tables: one row per visit / login / blocked request / privileged action.
import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.auth';

// visitLog: one row per incoming HTTP request. Bot flag derived from UA.
export const visitLog = pgTable(
  'visit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ip: text('ip'),
    path: text('path').notNull(),
    userAgent: text('user_agent'),
    isBot: boolean('is_bot').default(false).notNull(),
    botKind: text('bot_kind'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    /** Referer origin + path (query string stripped — may carry tokens). */
    referer: text('referer'),
    /** ISO 3166-1 alpha-2 country code from the edge/proxy geo header (null when unknown/local). */
    country: text('country'),
    region: text('region'),
    city: text('city'),
    /** Parsed from User-Agent / Client Hints — see server/middleware/visitor-ua.ts. */
    browser: text('browser'),
    browserVersion: text('browser_version'),
    os: text('os'),
    osVersion: text('os_version'),
    /** 'desktop' | 'mobile' | 'tablet' | 'bot' | null */
    deviceType: text('device_type'),
    /** Primary Accept-Language tag, e.g. 'id-ID'. */
    language: text('language'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('visit_log_created_at_idx').on(t.createdAt),
    index('visit_log_ip_idx').on(t.ip),
    index('visit_log_country_idx').on(t.country),
  ],
);

// loginLog: one row per successful login (session created).
export const loginLog = pgTable(
  'login_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ip: text('ip'),
    userAgent: text('user_agent'),
    /** 'email' | provider id (e.g. 'google') | 'impersonation' | 'switch' — from the auth endpoint path. */
    method: text('method'),
    /** Geo + device enrichment, same sources as visit_log (see server/middleware/request-meta.ts). */
    country: text('country'),
    region: text('region'),
    city: text('city'),
    browser: text('browser'),
    browserVersion: text('browser_version'),
    os: text('os'),
    osVersion: text('os_version'),
    deviceType: text('device_type'),
    language: text('language'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('login_log_user_id_idx').on(t.userId),
    index('login_log_created_at_idx').on(t.createdAt),
  ],
);

// rateLimitLog: one row per rate-limited (rejected) request.
export const rateLimitLog = pgTable(
  'rate_limit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ip: text('ip'),
    path: text('path').notNull(),
    /** HTTP method of the blocked request. */
    method: text('method'),
    userAgent: text('user_agent'),
    /** Geo + device enrichment, same sources as visit_log (see server/middleware/request-meta.ts). */
    country: text('country'),
    region: text('region'),
    city: text('city'),
    browser: text('browser'),
    browserVersion: text('browser_version'),
    os: text('os'),
    osVersion: text('os_version'),
    deviceType: text('device_type'),
    language: text('language'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('rate_limit_log_created_at_idx').on(t.createdAt),
    index('rate_limit_log_ip_idx').on(t.ip),
  ],
);

// auditLog: one row per privileged action taken through the console (role
// change, ban, delete, settings change, purge, impersonation). Actor fields
// are snapshotted so the row stays meaningful if the account is deleted.
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    /** Dotted verb, e.g. 'user.role.set', 'settings.rate_limit.update', 'logs.purge'. */
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    /** Human sentence shown in the console. */
    summary: text('summary').notNull(),
    meta: jsonb('meta'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('audit_log_created_at_idx').on(t.createdAt),
    index('audit_log_actor_id_idx').on(t.actorId),
    index('audit_log_action_idx').on(t.action),
  ],
);
