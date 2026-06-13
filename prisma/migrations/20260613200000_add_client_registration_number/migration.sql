-- AlterTable
ALTER TABLE "Client" ADD COLUMN "registrationNumber" INTEGER;

-- Backfill existing clients with sequential registration numbers per company,
-- ordered by the row id so the earliest client gets number 1.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY id) AS rn
  FROM "Client"
)
UPDATE "Client" c
SET "registrationNumber" = n.rn
FROM numbered n
WHERE c.id = n.id;

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_registrationNumber_key" ON "Client"("companyId", "registrationNumber");
