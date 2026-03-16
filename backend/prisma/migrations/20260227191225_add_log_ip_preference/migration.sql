-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "ipAddress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "logIpAddresses" BOOLEAN NOT NULL DEFAULT false;
