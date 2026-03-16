-- Add season and episode columns (default 0 for existing rows)
ALTER TABLE "Comment" ADD COLUMN "season" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Comment" ADD COLUMN "episode" INTEGER NOT NULL DEFAULT 0;

-- Deduplicate: keep only the most recent comment per user per (tmdbId, type)
DELETE FROM "Comment" a
USING "Comment" b
WHERE a.id < b.id
  AND a."userId" = b."userId"
  AND a."tmdbId" = b."tmdbId"
  AND a."type" = b."type";

-- Add unique constraint
CREATE UNIQUE INDEX "Comment_userId_tmdbId_type_season_episode_key" ON "Comment"("userId", "tmdbId", "type", "season", "episode");
