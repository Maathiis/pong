ALTER TABLE "matches" ADD COLUMN "remote_side" varchar(5);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;