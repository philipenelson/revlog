export interface DomainVehicle {
  id: string;
  accountId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleData {
  // Client-generated id (mobile offline creation, ADR 0027's 2026-07-03
  // update) — omitted by the web client, which lets the DB default it.
  id?: string;
  accountId: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoPath: string | null;
}

import type { LogEntrySummary } from '../log-entry';

export interface DomainVehicleInsurance {
  company: string | null;
  policyNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  premium: string | null;
  premiumPeriod: 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL' | null;
  towNumber: string | null;
  notes: string | null;
}

export interface DomainVehicleDetail extends DomainVehicle {
  insurance: DomainVehicleInsurance | null;
  logEntries: LogEntrySummary[];
  stats: {
    totalSpent: string;
    lastLoggedAt: string | null;
  };
  transferPending: boolean;
  pendingTransfer: {
    recipientEmail: string;
    expiresAt: string;
  } | null;
}

export interface UpdateVehicleData {
  nickname?: string | null;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
}

export interface IVehicleRepository {
  create(data: CreateVehicleData): Promise<DomainVehicle>;
  // Ordered by updatedAt desc — see garage-list-api.md "Sort order proxy".
  findAllByAccountId(accountId: string): Promise<(DomainVehicle & { logEntryCount: number })[]>;
  // Scoped update — returns null when the vehicle does not exist or
  // belongs to a different account (guards the photo upload endpoint).
  setPhoto(vehicleId: string, accountId: string, photoPath: string): Promise<DomainVehicle | null>;
  // Full detail fetch — includes insurance and log entry summaries.
  findDetailById(vehicleId: string): Promise<DomainVehicleDetail | null>;
  update(vehicleId: string, data: UpdateVehicleData): Promise<DomainVehicle>;
  delete(vehicleId: string): Promise<void>;
}
