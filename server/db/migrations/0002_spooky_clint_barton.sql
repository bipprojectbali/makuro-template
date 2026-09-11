CREATE TABLE "login_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text,
	"path" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ip" text,
	"path" text NOT NULL,
	"user_agent" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"bot_kind" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_log" ADD CONSTRAINT "login_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_log" ADD CONSTRAINT "rate_limit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_log" ADD CONSTRAINT "visit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_log_user_id_idx" ON "login_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_log_created_at_idx" ON "login_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_log_created_at_idx" ON "rate_limit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_log_ip_idx" ON "rate_limit_log" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "visit_log_created_at_idx" ON "visit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "visit_log_ip_idx" ON "visit_log" USING btree ("ip");