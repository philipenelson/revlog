import { apiFetch } from "@/infrastructure/http/apiClient";
import type { VehicleReportToken, MechanicPrintout } from "@/domain/types";

export async function getReportToken(vehicleId: string): Promise<VehicleReportToken> {
  return apiFetch<VehicleReportToken>(`/vehicles/${vehicleId}/report-token`);
}

export async function createReportToken(vehicleId: string): Promise<VehicleReportToken> {
  const data = await apiFetch<{ shareToken: string; shareUrl: string }>(
    `/vehicles/${vehicleId}/report-token`,
    { method: "POST" },
  );
  return { shareToken: data.shareToken, shareUrl: data.shareUrl };
}

export async function revokeReportToken(vehicleId: string): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/report-token`, { method: "DELETE" });
}

export async function emailReportLink(vehicleId: string, email: string): Promise<void> {
  await apiFetch(`/vehicles/${vehicleId}/report-token/email`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function getMechanicPrintout(shareToken: string): Promise<MechanicPrintout | null> {
  try {
    return await apiFetch<MechanicPrintout>(`/report/${shareToken}`);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}
