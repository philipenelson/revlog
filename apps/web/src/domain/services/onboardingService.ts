import { apiFetch } from "@/infrastructure/http/apiClient";

export async function skipOnboarding(): Promise<void> {
  await apiFetch("/onboarding/skip", {
    method: "POST",
  });
}
