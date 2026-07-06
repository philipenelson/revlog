-- Email verification moves from a UUID link token to a 6-digit OTP (ADR 0037).
-- No production data exists pre-launch, so the old columns are dropped outright.

-- AlterTable
ALTER TABLE "User" DROP COLUMN "verificationToken",
DROP COLUMN "verificationTokenExpiresAt",
ADD COLUMN     "verificationCodeHash" TEXT,
ADD COLUMN     "verificationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verificationAttemptsRemaining" INTEGER;
