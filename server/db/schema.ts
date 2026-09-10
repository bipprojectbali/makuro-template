import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('visit_log_created_at_idx').on(t.createdAt), index('visit_log_ip_idx').on(t.ip)],
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('login_log_user_id_idx').on(t.userId), index('login_log_created_at_idx').on(t.createdAt)],
);

// appSetting: singleton row (id='singleton') for runtime app configuration.
export const appSetting = pgTable('app_setting', {
  id: text('id').primaryKey().default('singleton'),
  /** Allow users to sign in / sign up with email+password. Default: false (Google-only). */
  emailAuthEnabled: boolean('email_auth_enabled').default(false).notNull(),
  /** Allow new user registrations. Set false to close the app to new signups. */
  signupEnabled: boolean('signup_enabled').default(true).notNull(),
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
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('rate_limit_log_created_at_idx').on(t.createdAt), index('rate_limit_log_ip_idx').on(t.ip)],
);
