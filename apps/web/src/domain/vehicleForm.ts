import { ApiError } from "@maintenance-log/api-client";
import type { VehicleDraft } from "@/domain/types";

// Shared pure core for the vehicle forms — add-vehicle, edit-vehicle, and the
// onboarding vehicle step (ADR 0043). No React, no I/O.

// The label a vehicle shows under: its nickname wins; otherwise "make model"
// when both are present; otherwise null (nothing to show yet).
export function vehicleDisplayLabel(nickname: string, make: string, model: string): string | null {
  const nick = nickname.trim();
  if (nick) return nick;
  const mk = make.trim();
  const md = model.trim();
  return mk && md ? `${mk} ${md}` : null;
}

// The required fields are all filled (nickname is optional) — drives the
// submit-enabled / "ready" affordances.
export function isVehicleDraftComplete(draft: VehicleDraft): boolean {
  return Boolean(draft.make.trim() && draft.model.trim() && draft.year.trim() && draft.mileage.trim());
}

export interface VehiclePayload {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

// Normalise the string draft into the API payload: trim text, coerce year and
// mileage to numbers (mileage may carry thousands commas), empty nickname → null.
export function buildVehiclePayload(draft: VehicleDraft): VehiclePayload {
  return {
    nickname: draft.nickname.trim() || null,
    make: draft.make.trim(),
    model: draft.model.trim(),
    year: Number(draft.year.trim()),
    mileage: Number(draft.mileage.trim().replace(/,/g, "")),
  };
}

export type VehicleLoadOutcome = "not-found" | "error";

// A 403/404 on a vehicle fetch means "not yours / gone" (show not-found); any
// other failure is a genuine error worth logging.
export function classifyVehicleLoadError(err: unknown): VehicleLoadOutcome {
  return err instanceof ApiError && (err.status === 403 || err.status === 404) ? "not-found" : "error";
}
