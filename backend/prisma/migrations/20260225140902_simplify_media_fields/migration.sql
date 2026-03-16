/*
  Warnings:

  - You are about to drop the column `overview` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `releaseDate` on the `Media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Media" DROP COLUMN "overview",
DROP COLUMN "releaseDate",
ADD COLUMN     "year" INTEGER;
