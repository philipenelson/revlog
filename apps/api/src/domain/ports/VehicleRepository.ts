import type {
  Vehicle,
  VehicleDetail,
  CreateVehicleData,
  UpdateVehicleData,
} from '../models/Vehicle';

export interface VehicleRepository {
  create(data: CreateVehicleData): Promise<Vehicle>;
  // Ordered by updatedAt desc — see garage-list-api.md "Sort order proxy".
  findAllByAccountId(accountId: string): Promise<(Vehicle & { logEntryCount: number })[]>;
  // Scoped update — returns null when the vehicle does not exist or
  // belongs to a different account (guards the photo upload endpoint).
  setPhoto(vehicleId: string, accountId: string, photoPath: string): Promise<Vehicle | null>;
  // Full detail fetch — includes insurance and log entry summaries.
  findDetailById(vehicleId: string): Promise<VehicleDetail | null>;
  update(vehicleId: string, data: UpdateVehicleData): Promise<Vehicle>;
  delete(vehicleId: string): Promise<void>;
  // Existence check across all accounts — used to distinguish 404 (no such
  // vehicle) from 403 (exists but not the caller's) without exposing the row.
  existsById(vehicleId: string): Promise<boolean>;
  // Raises the vehicle's mileage to `mileage` only when it currently reads lower
  // (odometers never run backwards); a no-op otherwise.
  bumpMileageIfLower(vehicleId: string, mileage: number): Promise<void>;
}
