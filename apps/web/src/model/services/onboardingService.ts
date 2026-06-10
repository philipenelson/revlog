import { apiFetch } from "@/infrastructure/http/apiClient";

export async function skipOnboarding(accessToken: string): Promise<void> {
  await apiFetch("/onboarding/skip", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
