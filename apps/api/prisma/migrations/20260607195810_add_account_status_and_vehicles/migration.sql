-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ONBOARDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ONBOARDING';

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "nickname" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vehicle_accountId_idx" ON "Vehicle"("accountId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
