import type { HttpClient } from '../HttpClient';
import type { InsuranceInput, InsuranceRecord } from '../types';

export async function saveInsurance(
  client: HttpClient,
  vehicleId: string,
  input: InsuranceInput,
): Promise<InsuranceRecord> {
  const data = await client.put<{ insurance: InsuranceRecord }>(`/vehicles/${vehicleId}/insurance`, input);
  return data.insurance;
}
