import { apiFetch } from "@/infrastructure/http/apiClient";
import type { InsuranceInput, InsuranceRecord } from "@/domain/types";

export async function saveInsurance(
  vehicleId: string,
  input: InsuranceInput,
): Promise<InsuranceRecord> {
  const data = await apiFetch<{ insurance: InsuranceRecord }>(
    `/vehicles/${vehicleId}/insurance`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return data.insurance;
}
