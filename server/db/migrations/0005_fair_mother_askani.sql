-- Login enrichment: auth method + geo (proxy headers) + parsed device info + language,
-- so /dev/login-logs can show where and how each sign-in happened.
-- Guards are idempotent so re-running on prod is safe.
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "method" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "country" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "browser" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "browser_version" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "os" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "os_version" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "device_type" text;--> statement-breakpoint
ALTER TABLE "login_log" ADD COLUMN IF NOT EXISTS "language" text;
