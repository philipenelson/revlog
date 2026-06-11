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

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listVehicles(accessToken: string): Promise<VehicleSummary[]> {
  const data = await apiFetch<{ vehicles: VehicleSummary[] }>("/vehicles", {
    headers: authHeaders(accessToken),
  });
  return data.vehicles;
}

export async function getVehicle(accessToken: string, vehicleId: string): Promise<VehicleDetail> {
  const data = await apiFetch<{ vehicle: VehicleDetail }>(`/vehicles/${vehicleId}`, {
    headers: authHeaders(accessToken),
  });
  return data.vehicle;
}

export async function createVehicle(
  accessToken: string,
  payload: CreateVehiclePayload,
): Promise<void> {
  await apiFetch("/vehicles", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function createVehicleWithPhoto(
  accessToken: string,
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
  await apiUpload<unknown>("/vehicles", fd, accessToken);
}

export async function updateVehicle(
  accessToken: string,
  vehicleId: string,
  payload: UpdateVehiclePayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
