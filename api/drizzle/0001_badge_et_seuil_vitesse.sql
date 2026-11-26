ALTER TABLE "matches" ADD COLUMN "badge_uid" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "speed_alert_threshold" real DEFAULT 2.5 NOT NULL;