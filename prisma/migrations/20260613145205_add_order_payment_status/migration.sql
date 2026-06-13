-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID_PIX', 'PAID_CREDIT', 'PAID_DEBIT', 'PAID_CASH', 'PAID_TRANSFER', 'PAID_OTHER');

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
