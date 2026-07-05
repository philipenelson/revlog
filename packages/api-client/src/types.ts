import type { AccountStatus } from '@maintenance-log/domain';

/* ── Auth ───────────────────────────────────────────────────────── */

export interface Session {
  accessToken: string;
  /** ISO 8601 — when the access token's `exp` lapses; drives proactive refresh (ADR 0021). */
  accessTokenExpiresAt: string;
  user: { id: string; accountId: string; role: string };
  account: { id: string; status: AccountStatus };
  /**
   * Present only when the request sent `X-Client-Platform: mobile` (ADR 0025).
   * Web relies on the httpOnly refreshToken cookie and never reads this field.
   * Mobile's AuthProvider reads it explicitly and persists it via secureStorage.
   */
  refreshToken?: string;
}

/* ── User ───────────────────────────────────────────────────────── */

/** Public profile returned by `GET /users/me` — never carries secrets (ADR 0033). */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
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

export interface PendingTransfer {
  recipientEmail: string;
  expiresAt: string;
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
  transferPending: boolean;
  pendingTransfer: PendingTransfer | null;
}

/* ── Transfers ──────────────────────────────────────────────────── */

export interface TransferDetails {
  status: 'PENDING';
  expiresAt: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    nickname: string | null;
    photoUrl: string | null;
    logEntryCount: number;
  };
  senderName: string;
}

/* ── Insurance ──────────────────────────────────────────────────── */

export type PremiumPeriod = 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL';

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

/* ── Mechanic Printout ──────────────────────────────────────────── */

export interface VehicleReportToken {
  shareToken: string | null;
  shareUrl: string | null;
}

export interface PrintoutLogItem {
  categoryId: string;
  description: string;
  quantity: string | null;
  unitCost: string | null;
}

export interface PrintoutLogEntry {
  id: string;
  typeId: string;
  title: string;
  date: string;
  mileage: number | null;
  notes: string | null;
  items: PrintoutLogItem[];
}

export interface MechanicPrintoutVehicle {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoUrl: string | null;
}

export interface MechanicPrintoutStats {
  logEntryCount: number;
  lastLoggedAt: string | null;
  totalSpent: string;
}

export interface MechanicPrintout {
  vehicle: MechanicPrintoutVehicle;
  stats: MechanicPrintoutStats;
  logEntries: PrintoutLogEntry[];
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
    mediaType: 'IMAGE' | 'VIDEO';
    caption: string | null;
  }>;
}
