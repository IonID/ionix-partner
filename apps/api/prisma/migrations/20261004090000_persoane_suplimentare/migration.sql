-- Fidejusorul sau codebitorul, adăugat de partener pe o cerere existentă.
CREATE TYPE "ExtraPersonRole" AS ENUM ('GUARANTOR', 'CODEBTOR');

CREATE TABLE "extra_persons" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "role" "ExtraPersonRole" NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extra_persons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "extra_persons_applicationId_idx" ON "extra_persons"("applicationId");

ALTER TABLE "extra_persons" ADD CONSTRAINT "extra_persons_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actele persoanei stau tot în "documents", legate de ea. Gol = actele clientului.
ALTER TABLE "documents" ADD COLUMN "personId" TEXT;

CREATE INDEX "documents_personId_idx" ON "documents"("personId");

ALTER TABLE "documents" ADD CONSTRAINT "documents_personId_fkey" FOREIGN KEY ("personId") REFERENCES "extra_persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
