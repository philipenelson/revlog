// Domain layer: shared interfaces, types, value objects, and validation schemas.
// No framework dependencies. No UI. No infrastructure.
// All apps import from here; nothing here imports from apps.

export * from './schemas/auth';
export * from './user';
export * from './account';
export * from './refresh-token';

export type UserId = string & { readonly __brand: 'UserId' };
export type VehicleId = string & { readonly __brand: 'VehicleId' };
export type LogEntryId = string & { readonly __brand: 'LogEntryId' };

export interface Vehicle {
  id: VehicleId;
  ownerId: UserId;
  make: string;
  model: string;
  year: number;
  vin?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogEntry {
  id: LogEntryId;
  vehicleId: VehicleId;
  date: Date;
  odometer: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
