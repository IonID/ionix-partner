-- AlterTable: add telegramAllowedUserIds to partners
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "telegramAllowedUserIds" TEXT;
