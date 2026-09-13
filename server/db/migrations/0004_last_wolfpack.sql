-- Visitor enrichment: geo (from edge/proxy headers), parsed device info, referer, language.
-- Why: the /dev/visits console needs country, browser, OS, and device data to be useful
-- for production traffic analysis. Guards are idempotent so re-running on prod is safe.
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "referer" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "country" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "browser" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "browser_version" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "os" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "os_version" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "device_type" text;--> statement-breakpoint
ALTER TABLE "visit_log" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_log_country_idx" ON "visit_log" USING btree ("country");
