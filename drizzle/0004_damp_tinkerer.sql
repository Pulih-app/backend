CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mood" integer NOT NULL,
	"note" text,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_check_ins_mood" CHECK ("check_ins"."mood" >= 1 AND "check_ins"."mood" <= 5)
);
--> statement-breakpoint
CREATE TABLE "relapses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mood" integer NOT NULL,
	"triggers" text[] NOT NULL,
	"note" text,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_relapses_mood" CHECK ("relapses"."mood" >= 1 AND "relapses"."mood" <= 5)
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_check_in_local_date" date,
	"last_relapse_local_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_streaks_current_non_negative" CHECK ("streaks"."current_streak" >= 0),
	CONSTRAINT "ck_streaks_longest_non_negative" CHECK ("streaks"."longest_streak" >= 0)
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relapses" ADD CONSTRAINT "relapses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_check_ins_user_local_date" ON "check_ins" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "idx_check_ins_user_local_date" ON "check_ins" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "idx_relapses_user_local_date" ON "relapses" USING btree ("user_id","local_date");