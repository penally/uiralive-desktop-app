/*
  Warnings:

  - A unique constraint covering the columns `[tmdbId,type]` on the table `Media` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Media_tmdbId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Media_tmdbId_type_key" ON "Media"("tmdbId", "type");
