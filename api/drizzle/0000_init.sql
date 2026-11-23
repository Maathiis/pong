CREATE TABLE "bornes" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(64),
	"online" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borne_id" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"target_score" integer DEFAULT 7 NOT NULL,
	"left_user_id" uuid,
	"right_user_id" uuid,
	"score_left" integer DEFAULT 0 NOT NULL,
	"score_right" integer DEFAULT 0 NOT NULL,
	"winner_side" varchar(5),
	"waiting_until" timestamp with time zone,
	"countdown_ends_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"max_speed" real DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"longest_rally" integer DEFAULT 0 NOT NULL,
	"total_bounces" integer DEFAULT 0 NOT NULL,
	"streak_side" varchar(5),
	"streak_count" integer DEFAULT 0 NOT NULL,
	"end_requests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudo" varchar(8) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"alert_offline" boolean DEFAULT true NOT NULL,
	"alert_speed_record" boolean DEFAULT true NOT NULL,
	"alert_match_point" boolean DEFAULT false NOT NULL,
	"retro_sounds" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_pseudo_unique" UNIQUE("pseudo"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_left_user_id_users_id_fk" FOREIGN KEY ("left_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_right_user_id_users_id_fk" FOREIGN KEY ("right_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;