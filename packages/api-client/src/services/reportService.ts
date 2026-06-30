import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import type { VehicleReportToken, MechanicPrintout } from '../types';

export function getReportToken(client: HttpClient, vehicleId: string): Promise<VehicleReportToken> {
  return client.get<VehicleReportToken>(`/vehicles/${vehicleId}/report-token`);
}

export async function createReportToken(client: HttpClient, vehicleId: string): Promise<VehicleReportToken> {
  const data = await client.post<{ shareToken: string; shareUrl: string }>(
    `/vehicles/${vehicleId}/report-token`,
  );
  return { shareToken: data.shareToken, shareUrl: data.shareUrl };
}

export async function revokeReportToken(client: HttpClient, vehicleId: string): Promise<void> {
  await client.delete(`/vehicles/${vehicleId}/report-token`);
}

export async function emailReportLink(client: HttpClient, vehicleId: string, email: string): Promise<void> {
  await client.post(`/vehicles/${vehicleId}/report-token/email`, { email });
}

export async function getMechanicPrintout(
  client: HttpClient,
  shareToken: string,
): Promise<MechanicPrintout | null> {
  try {
    return await client.get<MechanicPrintout>(`/report/${shareToken}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
