import type { LogEntrySummary } from './LogEntry';

export interface Vehicle {
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

export interface VehicleInsurance {
  company: string | null;
  policyNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  premium: string | null;
  premiumPeriod: 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL' | null;
  towNumber: string | null;
  notes: string | null;
}

export interface VehicleDetail extends Vehicle {
  insurance: VehicleInsurance | null;
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
