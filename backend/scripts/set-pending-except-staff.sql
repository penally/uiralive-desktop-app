-- Set all users to pending (isApproved = false) except admin/owner
UPDATE "User" SET "isApproved" = false WHERE "isAdmin" = false AND "isOwner" = false;
-- Ensure admin/owner are approved
UPDATE "User" SET "isApproved" = true WHERE "isAdmin" = true OR "isOwner" = true;
