/*
  Warnings:

  - You are about to alter the column `value` on the `ServiceOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "ServiceOrder" ALTER COLUMN "value" SET DATA TYPE DECIMAL(10,2);
