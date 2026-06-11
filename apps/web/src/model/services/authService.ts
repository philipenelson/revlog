import { apiFetch } from "@/infrastructure/http/apiClient";
import type { Session } from "@/model/types";
import type { LoginInput, RegisterInput } from "@maintenance-log/domain";

export function login(input: LoginInput): Promise<Session> {
  return apiFetch<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function register(input: RegisterInput): Promise<void> {
  await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Silent session restore from the HttpOnly refresh-token cookie (ADR 0017). */
export function refreshSession(): Promise<Session> {
  return apiFetch<Session>("/auth/refresh", { method: "POST" });
}

export function verifyEmail(token: string): Promise<Session> {
  return apiFetch<Session>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
