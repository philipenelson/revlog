import type { HttpClient } from '../HttpClient';
import type { Session } from '../types';
import type {
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@maintenance-log/domain';

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

/** Verify an email with the 6-digit OTP; on success the User is auto-signed in (ADR 0037). */
export function verifyEmail(client: HttpClient, input: VerifyEmailInput): Promise<Session> {
  return client.post<Session>('/auth/verify-email', input);
}

/** Re-issue a verification code. Always resolves (server is enumeration-safe, ADR 0037). */
export function resendVerification(client: HttpClient, input: ResendVerificationInput): Promise<void> {
  return client.post<void>('/auth/verify-email/resend', input);
}

/** Request a password reset code. Always resolves (server is enumeration-safe, ADR 0038). */
export function forgotPassword(client: HttpClient, input: ForgotPasswordInput): Promise<void> {
  return client.post<void>('/auth/forgot-password', input);
}

/** Reset the password with a 6-digit code; on success the User is auto-signed in (ADR 0038). */
export function resetPassword(client: HttpClient, input: ResetPasswordInput): Promise<Session> {
  return client.post<Session>('/auth/reset-password', input);
}
