-- Run this once to approve all existing users (grandfather them in)
UPDATE "User" SET "isApproved" = true;
