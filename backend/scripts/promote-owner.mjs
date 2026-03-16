#!/usr/bin/env node
/**
 * Promote a user to owner (full admin + promote/delete users) by email.
 * Usage: npx tsx scripts/promote-owner.mjs user@example.com
 * Requires DATABASE_URL in env (or .env).
 */
import "dotenv/config";
import { PrismaClient } from "../generated/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/promote-owner.mjs <email>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const user = await prisma.user.update({
    where: { email: email.trim() },
    data: { isOwner: true, isAdmin: true },
  });
  console.log(`✓ ${user.email} is now an owner`);
} catch (e) {
  if (e.code === "P2025") {
    console.error(`User not found: ${email}`);
  } else {
    console.error(e);
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
