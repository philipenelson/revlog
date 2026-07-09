-- Password reset via a 6-digit OTP (ADR 0038): same mechanism as email
-- verification, but its own columns so a reset code and a verification code can
-- be live at the same time without clobbering each other.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetCodeHash" TEXT,
ADD COLUMN     "passwordResetCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetAttemptsRemaining" INTEGER;
