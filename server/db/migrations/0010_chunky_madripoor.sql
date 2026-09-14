-- post.updated_at for the content console (edit tracking). Backfilled from created_at.
ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;--> statement-breakpoint
UPDATE "post" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "post" ALTER COLUMN "updated_at" SET NOT NULL;
