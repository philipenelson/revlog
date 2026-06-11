import type { AccountStatus } from "@maintenance-log/domain";

/* ── Auth ───────────────────────────────────────────────────────── */

export interface Session {
  accessToken: string;
  user: { id: string; accountId: string; role: string };
  account: { id: string; status: AccountStatus };
}

/* ── Vehicles ───────────────────────────────────────────────────── */

export interface VehicleSummary {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoUrl: string | null;
  logEntryCount: number;
}

export interface VehicleStats {
  totalSpent: string;
  lastLoggedAt: string | null;
}

export interface VehicleDetail {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoUrl: string | null;
  insurance: InsuranceRecord | null;
  logEntries: LogEntrySummary[];
  stats: VehicleStats;
}

/** Form draft for the add / edit / onboarding vehicle forms (raw input strings). */
export interface VehicleDraft {
  nickname: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
}

export type VehicleDraftErrors = Partial<Record<keyof VehicleDraft, string>>;

export function vehicleDisplayName(vehicle: {
  nickname: string | null;
  make: string;
  model: string;
}): string {
  return vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
}

/* ── Insurance ──────────────────────────────────────────────────── */

export type PremiumPeriod = "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL";

export interface InsuranceRecord {
  company: string | null;
  policyNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  premium: string | null;
  premiumPeriod: PremiumPeriod | null;
  towNumber: string | null;
  notes: string | null;
}

/** Payload for saving insurance — premium is numeric on the way in. */
export interface InsuranceInput {
  company: string | null;
  policyNumber: string | null;
  startDate: string | null;
  expiryDate: string | null;
  premium: number | null;
  premiumPeriod: PremiumPeriod | null;
  towNumber: string | null;
  notes: string | null;
}

/* ── Log entries ────────────────────────────────────────────────── */

export interface LogEntrySummary {
  id: string;
  typeId: string;
  title: string;
  date: string;
  time: string | null;
  mileage: number | null;
  itemCount: number;
  mediaCount: number;
  totalCost: string | null;
}

export interface LogEntryDetail {
  id: string;
  typeId: string;
  title: string;
  date: string;
  time: string | null;
  mileage: number | null;
  notes: string | null;
  items: Array<{
    id: string;
    categoryId: string;
    description: string;
    quantity: string | null;
    unitCost: string | null;
  }>;
  media: Array<{
    id: string;
    path: string;
    mediaType: "IMAGE" | "VIDEO";
    caption: string | null;
  }>;
}
