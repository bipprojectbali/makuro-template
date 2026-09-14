-- Console settings: log retention (+ scheduler bookkeeping), maintenance mode,
-- feature flags, branding. NULL = default / off. Idempotent for prod.
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_visit_days" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_login_days" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_rate_limit_days" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_audit_days" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_last_run_at" timestamp;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_last_result" jsonb;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "maintenance_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "maintenance_message" text;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "maintenance_allow_roles" text;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "feature_flags" jsonb;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "app_name" text;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "app_tagline" text;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "support_url" text;
