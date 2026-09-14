-- API keys (Better Auth apiKey plugin columns + rotation/allow-list/last-origin) and
-- per-request usage log; retention setting for the usage log. Idempotent for prod.
CREATE TABLE IF NOT EXISTS "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"permissions" text,
	"metadata" text,
	"rotated_from_id" text,
	"allowed_ips" text,
	"note" text,
	"last_ip" text,
	"last_country" text,
	"revoked_at" timestamp
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_key_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"ip" text,
	"country" text,
	"user_agent" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "app_setting" ADD COLUMN IF NOT EXISTS "retention_api_usage_days" integer;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "apikey" ADD CONSTRAINT "apikey_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_key_id_apikey_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_reference_id_idx" ON "apikey" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_key_idx" ON "apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_expires_at_idx" ON "apikey" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_usage_key_id_created_at_idx" ON "api_key_usage" USING btree ("key_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_usage_created_at_idx" ON "api_key_usage" USING btree ("created_at");
