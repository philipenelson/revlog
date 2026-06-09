-- CreateEnum
CREATE TYPE "PremiumPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL');

-- CreateTable
CREATE TABLE "VehicleInsurance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "company" TEXT,
    "policyNumber" TEXT,
    "startDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "premium" DECIMAL(10,2),
    "premiumPeriod" "PremiumPeriod",
    "towNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleInsurance_vehicleId_key" ON "VehicleInsurance"("vehicleId");

-- AddForeignKey
ALTER TABLE "VehicleInsurance" ADD CONSTRAINT "VehicleInsurance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
