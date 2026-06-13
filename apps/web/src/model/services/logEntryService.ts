import { apiFetch } from "@/infrastructure/http/apiClient";
import type { LogEntryDetail } from "@/model/types";

export interface LogItemPayload {
  categoryId: string;
  description: string;
  quantity: number | null;
  unitCost: number | null;
  sortOrder: number;
}

export interface LogMediaPayload {
  path: string;
  mediaType: "IMAGE" | "VIDEO";
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
  vehicleId: string,
  entryId: string,
): Promise<LogEntryDetail> {
  const data = await apiFetch<{ logEntry: LogEntryDetail }>(
    `/vehicles/${vehicleId}/log/${entryId}`,
  );
  return data.logEntry;
}

export async function createLogEntry(
  vehicleId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLogEntry(
  vehicleId: string,
  entryId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLogEntry(
  vehicleId: string,
  entryId: string,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
    method: "DELETE",
  });
}
