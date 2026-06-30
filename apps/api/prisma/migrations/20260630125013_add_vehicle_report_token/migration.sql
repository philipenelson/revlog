-- CreateTable
CREATE TABLE "VehicleReportToken" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleReportToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleReportToken_vehicleId_key" ON "VehicleReportToken"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleReportToken_token_key" ON "VehicleReportToken"("token");

-- CreateIndex
CREATE INDEX "VehicleReportToken_token_idx" ON "VehicleReportToken"("token");

-- AddForeignKey
ALTER TABLE "VehicleReportToken" ADD CONSTRAINT "VehicleReportToken_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
