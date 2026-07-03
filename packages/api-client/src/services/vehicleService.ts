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

function buildCreateVehicleFormData(payload: CreateVehiclePayload): FormData {
  const fd = new FormData();
  // Client-generated (mobile only, ADR 0027's 2026-07-03 update) — the web
  // client never sets `id`, so this branch never runs there.
  if (payload.id) fd.append('id', payload.id);
  fd.append('make', payload.make);
  fd.append('model', payload.model);
  fd.append('year', String(payload.year));
  fd.append('mileage', String(payload.mileage));
  if (payload.nickname) fd.append('nickname', payload.nickname);
  return fd;
}

export async function createVehicleWithPhoto(
  client: HttpClient,
  payload: CreateVehiclePayload,
  photo: File,
): Promise<void> {
  const fd = buildCreateVehicleFormData(payload);
  fd.append('photo', photo);
  // FormData body — the adapter lets the runtime set the multipart boundary.
  await client.post('/vehicles', fd);
}

// React Native's own `FormData` accepts a `{ uri, name, type }` descriptor
// for a file part; DOM's `FormData.append()` typing (this package also
// compiles against the web client) only models `string | Blob`, which is
// why this isn't just an overload of createVehicleWithPhoto above -- this is
// the one place a cross-platform package's shared types meet a
// platform-specific runtime shape. Used by the mobile Add Vehicle screen's
// CREATE_VEHICLE outbox handler (ADR 0027's 2026-07-03 "offline-durable
// photo upload" update), never by web.
export interface RNPhotoFile {
  uri: string;
  name: string;
  type: string;
}

export async function createVehicleWithPhotoUri(
  client: HttpClient,
  payload: CreateVehiclePayload,
  photo: RNPhotoFile,
): Promise<void> {
  const fd = buildCreateVehicleFormData(payload);
  fd.append('photo', photo as unknown as Blob);
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
