CREATE TYPE "public"."community_post_category" AS ENUM('general', 'support', 'progress');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "community_post_category" NOT NULL,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"local_date" date NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_motivations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"source" varchar(255),
	"local_date" date NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievement_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"progress_value" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_likes" ADD CONSTRAINT "community_post_likes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_likes" ADD CONSTRAINT "community_post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_achievements_key" ON "achievements" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_community_comments_post_id" ON "community_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_community_comments_user_id" ON "community_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_community_post_likes_post_user" ON "community_post_likes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_community_posts_user_id" ON "community_posts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_challenges_local_date" ON "daily_challenges" USING btree ("local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_motivations_local_date" ON "daily_motivations" USING btree ("local_date");--> statement-breakpoint
CREATE INDEX "idx_education_contents_status" ON "education_contents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_journals_user_id" ON "journals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_achievement_progress_user_achievement" ON "user_achievement_progress" USING btree ("user_id","achievement_id");--> statement-breakpoint
INSERT INTO "education_contents" ("title", "content", "category", "status", "published_at") VALUES
('Understanding Recovery', 'Recovery is built through small consistent steps, support, and safe routines. This content is educational and does not replace professional care.', 'recovery', 'published', now()),
('Managing Urges Safely', 'When urges appear, pause, move to a safer space, contact trusted support, and choose one healthy distraction for the next few minutes.', 'coping', 'published', now())
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "daily_motivations" ("content", "source", "local_date", "status") VALUES
('One steady choice today can support recovery.', 'Pulih', CURRENT_DATE, 'published')
ON CONFLICT ("local_date") DO NOTHING;--> statement-breakpoint
INSERT INTO "daily_challenges" ("title", "description", "category", "local_date", "status") VALUES
('Three-Minute Grounding', 'Take three minutes to breathe slowly and name five things you can see around you.', 'grounding', CURRENT_DATE, 'published')
ON CONFLICT ("local_date") DO NOTHING;--> statement-breakpoint
INSERT INTO "achievements" ("key", "title", "description", "criteria") VALUES
('first_check_in', 'First Check-in', 'Complete your first recovery check-in.', '{"type":"check_in_count","target":1}'::jsonb),
('first_journal', 'First Journal', 'Write your first private journal entry.', '{"type":"journal_count","target":1}'::jsonb),
('seven_day_streak', 'Seven-Day Streak', 'Build a seven-day recovery streak.', '{"type":"streak","target":7}'::jsonb)
ON CONFLICT ("key") DO NOTHING;