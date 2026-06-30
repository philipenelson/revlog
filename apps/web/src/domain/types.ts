/* ── Vehicles ───────────────────────────────────────────────────── */

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
