import { apiFetch } from "@/infrastructure/http/apiClient";
import type { InsuranceInput, InsuranceRecord } from "@/model/types";

export async function saveInsurance(
  accessToken: string,
  vehicleId: string,
  input: InsuranceInput,
): Promise<InsuranceRecord> {
  const data = await apiFetch<{ insurance: InsuranceRecord }>(
    `/vehicles/${vehicleId}/insurance`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  return data.insurance;
}
