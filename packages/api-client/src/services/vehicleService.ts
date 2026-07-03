import type { HttpClient } from '../HttpClient';
import type { VehicleDetail, VehicleSummary } from '../types';

export interface CreateVehiclePayload {
  // Client-generated (mobile offline creation, ADR 0027's 2026-07-03
  // update) — the web client never sets this, letting the API default it.
  id?: string;
  nickname?: string | null;
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

export async function listVehicles(client: HttpClient): Promise<VehicleSummary[]> {
  const data = await client.get<{ vehicles: VehicleSummary[] }>('/vehicles');
  return data.vehicles;
}

export async function getVehicle(client: HttpClient, vehicleId: string): Promise<VehicleDetail> {
  const data = await client.get<{ vehicle: VehicleDetail }>(`/vehicles/${vehicleId}`);
  return data.vehicle;
}

export async function createVehicle(client: HttpClient, payload: CreateVehiclePayload): Promise<void> {
  await client.post('/vehicles', payload);
}

export async function createVehicleWithPhoto(
  client: HttpClient,
  payload: CreateVehiclePayload,
  photo: File,
): Promise<void> {
  const fd = new FormData();
  fd.append('photo', photo);
  fd.append('make', payload.make);
  fd.append('model', payload.model);
  fd.append('year', String(payload.year));
  fd.append('mileage', String(payload.mileage));
  if (payload.nickname) fd.append('nickname', payload.nickname);
  // FormData body — the adapter lets the runtime set the multipart boundary.
  await client.post('/vehicles', fd);
}

export async function updateVehicle(
  client: HttpClient,
  vehicleId: string,
  payload: UpdateVehiclePayload,
): Promise<void> {
  await client.patch(`/vehicles/${vehicleId}`, payload);
}

export async function deleteVehicle(client: HttpClient, vehicleId: string): Promise<void> {
  await client.delete(`/vehicles/${vehicleId}`);
}
