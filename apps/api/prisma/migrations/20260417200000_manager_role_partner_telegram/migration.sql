-- Add MANAGER role to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';

-- Add per-partner Telegram fields
ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "telegramBotToken" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramChatId"   TEXT,
  ADD COLUMN IF NOT EXISTS "telegramEnabled"  BOOLEAN NOT NULL DEFAULT true;
