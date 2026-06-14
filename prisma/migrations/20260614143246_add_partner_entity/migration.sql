-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_companyId_name_key" ON "Partner"("companyId", "name");

-- AddForeignKey (Partner -> Company)
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add partnerId column (nullable, no FK yet)
ALTER TABLE "Client" ADD COLUMN "partnerId" INTEGER;

-- Backfill: insert one Partner row per distinct (companyId, partnerName) pair
INSERT INTO "Partner" ("name", "companyId", "updatedAt")
SELECT DISTINCT "partnerName", "companyId", CURRENT_TIMESTAMP
FROM "Client"
WHERE "partnerName" IS NOT NULL;

-- Backfill: set partnerId on each Client that had a partnerName
UPDATE "Client" c
SET "partnerId" = p."id"
FROM "Partner" p
WHERE c."partnerName" IS NOT NULL
  AND c."companyId" = p."companyId"
  AND c."partnerName" = p."name";

-- Drop the old partnerName column
ALTER TABLE "Client" DROP COLUMN "partnerName";

-- AddForeignKey (Client -> Partner)
ALTER TABLE "Client" ADD CONSTRAINT "Client_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
