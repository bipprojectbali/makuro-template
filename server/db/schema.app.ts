// Application tables: sample content and the runtime settings singleton.
import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.auth';

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
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

export const postRelations = relations(post, ({ one }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  posts: many(post),
}));

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
  retentionApiUsageDays: integer('retention_api_usage_days'),
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
