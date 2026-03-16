-- Remove IP logging columns from Session and User tables
ALTER TABLE "Session" DROP COLUMN IF EXISTS "ipAddress";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "city";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "country";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "countryCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "logIpAddresses";
