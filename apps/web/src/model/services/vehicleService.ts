import { apiFetch, apiUpload } from "@/infrastructure/http/apiClient";
import type { VehicleDetail, VehicleSummary } from "@/model/types";

export interface CreateVehiclePayload {
  nickname?: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export interface UpdateVehiclePayload {
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export async function listVehicles(): Promise<VehicleSummary[]> {
  const data = await apiFetch<{ vehicles: VehicleSummary[] }>("/vehicles");
  return data.vehicles;
}

export async function getVehicle(vehicleId: string): Promise<VehicleDetail> {
  const data = await apiFetch<{ vehicle: VehicleDetail }>(`/vehicles/${vehicleId}`);
  return data.vehicle;
}

export async function createVehicle(
  payload: CreateVehiclePayload,
): Promise<void> {
  await apiFetch("/vehicles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createVehicleWithPhoto(
  payload: CreateVehiclePayload,
  photo: File,
): Promise<void> {
  const fd = new FormData();
  fd.append("photo", photo);
  fd.append("make", payload.make);
  fd.append("model", payload.model);
  fd.append("year", String(payload.year));
  fd.append("mileage", String(payload.mileage));
  if (payload.nickname) fd.append("nickname", payload.nickname);
  await apiUpload<unknown>("/vehicles", fd);
}

export async function updateVehicle(
  vehicleId: string,
  payload: UpdateVehiclePayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
