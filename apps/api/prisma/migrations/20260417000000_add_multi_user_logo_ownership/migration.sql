-- DropForeignKey (old Partner→User relation)
ALTER TABLE "partners" DROP CONSTRAINT IF EXISTS "partners_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "partners_userId_key";

-- AlterTable: add new columns first (nullable)
ALTER TABLE "applications" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "partners"     ADD COLUMN "logoPath" TEXT;
ALTER TABLE "users"        ADD COLUMN "partnerId" TEXT;

-- Data migration: copy userId from partners to users.partnerId
UPDATE "users" u
SET "partnerId" = p."id"
FROM "partners" p
WHERE p."userId" = u."id";

-- Drop old userId column from partners
ALTER TABLE "partners" DROP COLUMN IF EXISTS "userId";

-- CreateIndex
CREATE INDEX "users_partnerId_idx" ON "users"("partnerId");

-- AddForeignKey: users.partnerId → partners.id
ALTER TABLE "users" ADD CONSTRAINT "users_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "partners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: applications.createdByUserId → users.id
ALTER TABLE "applications" ADD CONSTRAINT "applications_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
