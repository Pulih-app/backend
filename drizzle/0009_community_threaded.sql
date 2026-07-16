-- community_post_category: general|support|progress -> advice|motivation|story|question|help
ALTER TYPE "community_post_category" RENAME TO "community_post_category_old";
CREATE TYPE "community_post_category" AS ENUM ('advice', 'motivation', 'story', 'question', 'help');
ALTER TABLE "community_posts" ALTER COLUMN "category" SET DATA TYPE "community_post_category" USING
  CASE "category"::text
    WHEN 'general' THEN 'story'::text
    WHEN 'support' THEN 'help'::text
    WHEN 'progress' THEN 'motivation'::text
    ELSE 'story'::text
  END::"community_post_category";
DROP TYPE "community_post_category_old";

-- community_posts: add optional title column
ALTER TABLE "community_posts" ADD COLUMN "title" varchar(120);

-- community_comments: add threaded comment columns
ALTER TABLE "community_comments" ADD COLUMN "parent_comment_id" uuid;
ALTER TABLE "community_comments" ADD COLUMN "depth" integer NOT NULL DEFAULT 0;
ALTER TABLE "community_comments" ADD COLUMN "reply_count" integer NOT NULL DEFAULT 0;
CREATE INDEX "idx_community_comments_parent_id" ON "community_comments" ("parent_comment_id");
