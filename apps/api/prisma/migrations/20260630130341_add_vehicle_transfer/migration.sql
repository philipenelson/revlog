/*
  Warnings:

  - You are about to drop the `VehicleReportToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "VehicleTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "VehicleReportToken" DROP CONSTRAINT "VehicleReportToken_vehicleId_fkey";

-- DropTable
DROP TABLE "VehicleReportToken";

-- CreateTable
CREATE TABLE "VehicleTransfer" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientAccountId" TEXT,
    "token" TEXT NOT NULL,
    "status" "VehicleTransferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTransfer_token_key" ON "VehicleTransfer"("token");

-- CreateIndex
CREATE INDEX "VehicleTransfer_vehicleId_idx" ON "VehicleTransfer"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleTransfer_token_idx" ON "VehicleTransfer"("token");

-- AddForeignKey
ALTER TABLE "VehicleTransfer" ADD CONSTRAINT "VehicleTransfer_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
