import type { HttpClient } from '../HttpClient';
import type { LogEntryDetail } from '../types';

export interface LogItemPayload {
  categoryId: string;
  description: string;
  quantity: number | null;
  unitCost: number | null;
  sortOrder: number;
}

export interface LogMediaPayload {
  path: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string | null;
  sortOrder: number;
}

export interface LogEntryPayload {
  typeId: string;
  title: string;
  date: string;
  time: string | null;
  mileage: number | null;
  notes: string | null;
  items: LogItemPayload[];
  media?: LogMediaPayload[];
}

export async function getLogEntry(
  client: HttpClient,
  vehicleId: string,
  entryId: string,
): Promise<LogEntryDetail> {
  const data = await client.get<{ logEntry: LogEntryDetail }>(`/vehicles/${vehicleId}/log/${entryId}`);
  return data.logEntry;
}

export async function createLogEntry(
  client: HttpClient,
  vehicleId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await client.post(`/vehicles/${vehicleId}/log`, payload);
}

export async function updateLogEntry(
  client: HttpClient,
  vehicleId: string,
  entryId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await client.patch(`/vehicles/${vehicleId}/log/${entryId}`, payload);
}

export async function deleteLogEntry(client: HttpClient, vehicleId: string, entryId: string): Promise<void> {
  await client.delete(`/vehicles/${vehicleId}/log/${entryId}`);
}
