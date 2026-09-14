import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// --- Better Auth core tables ---------------------------------------------
// These match the Better Auth Drizzle adapter schema. You can regenerate
// them with: bun run auth:generate

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
  // Better Auth admin plugin fields.
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Better Auth admin plugin: set while an admin impersonates this user.
  impersonatedBy: text('impersonated_by'),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

// --- App tables ----------------------------------------------------------

export const post = pgTable('post', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content'),
  authorId: text('author_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

export const postRelations = relations(post, ({ one }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  posts: many(post),
}));

// --- Analytics tables ---------------------------------------------------
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

// appSetting: singleton row (id='singleton') for runtime app configuration.
export const appSetting = pgTable('app_setting', {
  id: text('id').primaryKey().default('singleton'),
  /** Allow users to sign in / sign up with email+password. Default: false (Google-only). */
  emailAuthEnabled: boolean('email_auth_enabled').default(false).notNull(),
  /** Allow new user registrations. Set false to close the app to new signups. */
  signupEnabled: boolean('signup_enabled').default(true).notNull(),
  // API rate limiting. NULL = fall back to the env default (RATE_LIMIT_*), so
  // the console can show "default" vs "overridden" and reset per field.
  rateLimitEnabled: boolean('rate_limit_enabled').default(true).notNull(),
  rateLimitMax: integer('rate_limit_max'),
  rateLimitWindowMs: integer('rate_limit_window_ms'),
  /** Newline-separated path prefixes that are never limited; NULL = default list. */
  rateLimitExcludePrefixes: text('rate_limit_exclude_prefixes'),
  // Log retention (days). NULL = never purge automatically. The scheduler runs
  // once a day and records its last result here for the console.
  retentionVisitDays: integer('retention_visit_days'),
  retentionLoginDays: integer('retention_login_days'),
  retentionRateLimitDays: integer('retention_rate_limit_days'),
  retentionAuditDays: integer('retention_audit_days'),
  retentionLastRunAt: timestamp('retention_last_run_at'),
  retentionLastResult: jsonb('retention_last_result'),
  // Maintenance mode: everyone except the allowed roles gets a 503 page/JSON.
  maintenanceEnabled: boolean('maintenance_enabled').default(false).notNull(),
  maintenanceMessage: text('maintenance_message'),
  /** Newline-separated roles that may still use the app; NULL = super-admin only. */
  maintenanceAllowRoles: text('maintenance_allow_roles'),
  /** Feature flags: [{ key, enabled, description }]. */
  featureFlags: jsonb('feature_flags'),
  // Branding overrides; NULL = built-in defaults.
  appName: text('app_name'),
  appTagline: text('app_tagline'),
  supportUrl: text('support_url'),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

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
