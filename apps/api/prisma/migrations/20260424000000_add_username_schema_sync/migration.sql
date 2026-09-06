-- Add username column (nullable, unique)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

-- Make email nullable (was NOT NULL in init migration)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Add VIEWER and PARTNER_ADMIN to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PARTNER_ADMIN';

-- Add statusChangedByName to applications
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "statusChangedByName" TEXT;
