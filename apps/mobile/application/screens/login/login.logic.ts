import { SERVICE_ERROR } from '@/domain/apiError';

// Pure functional core for the Login screen (ADR 0043). No React, no I/O.

export const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
export const OFFLINE_MISMATCH_ERROR =
  "You're offline, and these credentials don't match your last sign-in on this device.";

// The error message for a non-successful sign-in status, or null for the two
// success statuses (online / offline) which route instead of showing an error.
export function signInErrorMessage(status: string): string | null {
  switch (status) {
    case 'invalidCredentials':
      return SIGN_IN_USER_ERROR;
    case 'offlineUnavailable':
      return OFFLINE_MISMATCH_ERROR;
    case 'serviceError':
      return SERVICE_ERROR;
    default:
      return null;
  }
}

// After an online login, offer biometric enrolment once — only when the
// hardware is available and the Owner hasn't been prompted or already opted in
// (ADR 0036).
export function shouldOfferBiometricEnrolment(
  prompted: boolean,
  enabled: boolean,
  available: boolean,
): boolean {
  return !prompted && !enabled && available;
}
