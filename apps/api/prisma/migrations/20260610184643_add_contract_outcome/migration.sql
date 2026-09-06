-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "contractOutcome" TEXT,
ADD COLUMN     "contractOutcomeAt" TIMESTAMP(3),
ADD COLUMN     "contractOutcomeByName" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
