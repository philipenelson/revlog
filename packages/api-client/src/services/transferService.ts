import type { HttpClient } from '../HttpClient';
import type { TransferDetails } from '../types';

export async function getTransferDetails(client: HttpClient, token: string): Promise<TransferDetails> {
  const data = await client.get<{ transfer: TransferDetails }>(`/transfers/${token}`);
  return data.transfer;
}

export async function initiateTransfer(
  client: HttpClient,
  vehicleId: string,
  recipientEmail: string,
): Promise<{ id: string; status: string; recipientEmail: string; expiresAt: string }> {
  const data = await client.post<{
    transfer: { id: string; status: string; recipientEmail: string; expiresAt: string };
  }>(`/vehicles/${vehicleId}/transfer`, { recipientEmail });
  return data.transfer;
}

export async function acceptTransfer(client: HttpClient, token: string): Promise<string> {
  const data = await client.post<{ vehicleId: string }>(`/transfers/${token}/accept`);
  return data.vehicleId;
}

export async function declineTransfer(client: HttpClient, token: string): Promise<void> {
  await client.post<void>(`/transfers/${token}/decline`);
}

export async function cancelTransfer(client: HttpClient, vehicleId: string): Promise<void> {
  await client.delete<void>(`/vehicles/${vehicleId}/transfer`);
}
