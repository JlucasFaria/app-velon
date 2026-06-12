-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "invitedEmail" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Membership_inviteToken_key" ON "Membership"("inviteToken");
