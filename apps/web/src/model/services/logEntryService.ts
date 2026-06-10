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

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function getLogEntry(
  accessToken: string,
  vehicleId: string,
  entryId: string,
): Promise<LogEntryDetail> {
  const data = await apiFetch<{ logEntry: LogEntryDetail }>(
    `/vehicles/${vehicleId}/log/${entryId}`,
    { headers: authHeaders(accessToken) },
  );
  return data.logEntry;
}

export async function createLogEntry(
  accessToken: string,
  vehicleId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function updateLogEntry(
  accessToken: string,
  vehicleId: string,
  entryId: string,
  payload: LogEntryPayload,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteLogEntry(
  accessToken: string,
  vehicleId: string,
  entryId: string,
): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/log/${entryId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}
