-- Demo sandbox: anonymous demo visitors (Better Auth anonymous plugin) + the
-- /dev switch and TTL that control them. Idempotent for prod.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "demo_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "demo_ttl_hours" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_is_anonymous_created_at_idx" ON "user" USING btree ("is_anonymous","created_at");
