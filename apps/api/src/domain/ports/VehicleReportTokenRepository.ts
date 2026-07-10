import type { VehicleReportToken, MechanicPrintout } from '../models/VehicleReportToken';

export interface VehicleReportTokenRepository {
  upsertByVehicleId(vehicleId: string): Promise<VehicleReportToken>;
  deleteByVehicleId(vehicleId: string): Promise<boolean>;
  findByToken(token: string): Promise<VehicleReportToken | null>;
  findByVehicleId(vehicleId: string): Promise<VehicleReportToken | null>;
  findPrintoutByToken(token: string): Promise<MechanicPrintout | null>;
}
