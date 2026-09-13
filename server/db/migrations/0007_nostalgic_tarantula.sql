-- Runtime rate-limit settings (editable at /dev/settings). NULL = use the env
-- default (RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS / built-in exclusions), so the
-- console can distinguish "default" from "overridden". Idempotent for prod.
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "rate_limit_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "rate_limit_max" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "rate_limit_window_ms" integer;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "rate_limit_exclude_prefixes" text;
