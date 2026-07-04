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

// A Blob-like value with a name/type/bytes() — satisfied by expo-file-
// system's `File` (which `implements Blob`), NOT a plain `{ uri, name,
// type }` descriptor. This package's web-only createVehicleWithPhoto above
// takes a DOM `File` directly; a separate function exists here because this
// package doesn't (and shouldn't) depend on expo-file-system to name that
// type precisely — a minimal structural interface is enough for FormData's
// purposes. Used by the mobile Add Vehicle screen's CREATE_VEHICLE outbox
// handler (ADR 0027's 2026-07-03 "offline-durable photo upload" update),
// never by web.
export interface UploadableFile {
  name: string;
  type: string;
  bytes(): Promise<Uint8Array>;
}

export async function createVehicleWithPhotoUri(
  client: HttpClient,
  payload: CreateVehiclePayload,
  photo: UploadableFile,
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

export interface SetVehiclePhotoResponse {
  photoUrl: string | null;
}

export async function setVehiclePhoto(
  client: HttpClient,
  vehicleId: string,
  photo: File,
): Promise<SetVehiclePhotoResponse> {
  const fd = new FormData();
  fd.append('photo', photo);
  return client.post<SetVehiclePhotoResponse>(`/vehicles/${vehicleId}/photo`, fd);
}

// React-Native-shaped sibling of setVehiclePhoto, matching
// createVehicleWithPhotoUri's relationship to createVehicleWithPhoto —
// see this file's UploadableFile doc comment for why.
export async function setVehiclePhotoUri(
  client: HttpClient,
  vehicleId: string,
  photo: UploadableFile,
): Promise<SetVehiclePhotoResponse> {
  const fd = new FormData();
  fd.append('photo', photo as unknown as Blob);
  return client.post<SetVehiclePhotoResponse>(`/vehicles/${vehicleId}/photo`, fd);
}

export async function deleteVehicle(client: HttpClient, vehicleId: string): Promise<void> {
  await client.delete(`/vehicles/${vehicleId}`);
}
