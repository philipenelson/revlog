import { apiFetch } from "@/infrastructure/http/apiClient";
import type { TransferDetails } from "@/model/types";

export async function getTransferDetails(token: string): Promise<TransferDetails> {
  const data = await apiFetch<{ transfer: TransferDetails }>(`/transfers/${token}`);
  return data.transfer;
}

export async function initiateTransfer(
  vehicleId: string,
  recipientEmail: string,
): Promise<{ id: string; status: string; recipientEmail: string; expiresAt: string }> {
  const data = await apiFetch<{
    transfer: { id: string; status: string; recipientEmail: string; expiresAt: string };
  }>(`/vehicles/${vehicleId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ recipientEmail }),
  });
  return data.transfer;
}

export async function acceptTransfer(token: string): Promise<string> {
  const data = await apiFetch<{ vehicleId: string }>(`/transfers/${token}/accept`, {
    method: "POST",
  });
  return data.vehicleId;
}

export async function declineTransfer(token: string): Promise<void> {
  await apiFetch<void>(`/transfers/${token}/decline`, { method: "POST" });
}

export async function cancelTransfer(vehicleId: string): Promise<void> {
  await apiFetch<void>(`/vehicles/${vehicleId}/transfer`, { method: "DELETE" });
}
