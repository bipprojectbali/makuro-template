-- Daily rollup of api_key_usage per key + endpoint (90-day charts stay cheap and
-- survive raw-row retention). Idempotent for prod.
CREATE TABLE IF NOT EXISTS "api_key_usage_daily" (
	"key_id" text NOT NULL,
	"day" date NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"duration_sum_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_key_usage_daily_key_id_day_method_path_pk" PRIMARY KEY("key_id","day","method","path")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "api_key_usage_daily" ADD CONSTRAINT "api_key_usage_daily_key_id_apikey_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_usage_daily_key_id_day_idx" ON "api_key_usage_daily" USING btree ("key_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_key_usage_daily_day_idx" ON "api_key_usage_daily" USING btree ("day");
