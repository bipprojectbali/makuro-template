CREATE TABLE "app_setting" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"email_auth_enabled" boolean DEFAULT false NOT NULL,
	"signup_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp NOT NULL
);
