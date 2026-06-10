-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "footerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex (old global unique constraints replaced by per-company composites)
DROP INDEX "Client_document_key";
DROP INDEX "ServiceOrder_orderNumber_key";

-- AlterTable: add companyId as nullable first so existing rows can be backfilled
ALTER TABLE "Client" ADD COLUMN "companyId" INTEGER;
ALTER TABLE "ServiceOrder" ADD COLUMN "companyId" INTEGER;

-- Data migration: create a default company and attach all existing data + users to it.
-- Existing single-tenant data is preserved by moving it under one default company.
INSERT INTO "Company" ("name", "updatedAt") VALUES ('Minha Empresa', CURRENT_TIMESTAMP);

UPDATE "Client" SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" ASC LIMIT 1);
UPDATE "ServiceOrder" SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" ASC LIMIT 1);

-- Every existing user becomes an active ADMIN of the default company.
INSERT INTO "Membership" ("userId", "companyId", "role", "status", "updatedAt")
SELECT "id", (SELECT "id" FROM "Company" ORDER BY "id" ASC LIMIT 1), 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP
FROM "User";

-- Now that all rows are backfilled, enforce NOT NULL
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ServiceOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex (per-company uniqueness)
CREATE UNIQUE INDEX "Client_companyId_document_key" ON "Client"("companyId", "document");
CREATE UNIQUE INDEX "ServiceOrder_companyId_orderNumber_key" ON "ServiceOrder"("companyId", "orderNumber");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
