import type { UpsertInsuranceInput } from '@maintenance-log/contracts';
import type { VehicleInsurance } from '../models/Vehicle';

export interface InsuranceRepository {
  findByVehicleId(vehicleId: string): Promise<VehicleInsurance | null>;
  upsert(vehicleId: string, input: UpsertInsuranceInput): Promise<VehicleInsurance>;
  delete(vehicleId: string): Promise<boolean>;
}
