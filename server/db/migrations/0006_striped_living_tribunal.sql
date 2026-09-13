-- Rate-limit log enrichment: HTTP method, user agent, geo (proxy headers), parsed
-- device info and language, so /dev/rate-limit-logs can show who is being blocked.
-- Guards are idempotent so re-running on prod is safe.
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "method" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "country" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "browser" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "browser_version" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "os" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "os_version" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "device_type" text;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD COLUMN IF NOT EXISTS "language" text;
