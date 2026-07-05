import type { HttpClient } from '../HttpClient';
import type { Session } from '../types';
import type { LoginInput, RegisterInput } from '@maintenance-log/domain';

export function login(client: HttpClient, input: LoginInput): Promise<Session> {
  return client.post<Session>('/auth/login', input);
}

export async function register(client: HttpClient, input: RegisterInput): Promise<void> {
  await client.post('/auth/register', input);
}

/** Silent session restore — httpOnly cookie on web (ADR 0017), Refresh-Token header on mobile (ADR 0025). */
export function refreshSession(client: HttpClient): Promise<Session> {
  return client.post<Session>('/auth/refresh');
}

/** Revoke the caller's refresh token server-side (online-required logout, ADR 0034). Returns 204. */
export function logout(client: HttpClient): Promise<void> {
  return client.post<void>('/auth/logout');
}

export function verifyEmail(client: HttpClient, token: string): Promise<Session> {
  return client.get<Session>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
