import { ApiError } from '@maintenance-log/api-client';

// Shared pure helpers for classifying API failures (ADR 0043) — the mobile
// counterpart of apps/web's domain/apiError. No React, no I/O.

export const SERVICE_ERROR = 'We stalled. Our mechanics are on it — try again in a moment.';
export const OTP_INVALID_CODE = "That code isn't right. Check it and try again.";
export const OTP_CODE_EXPIRED = 'That code has expired or been used up. Request a new one.';

// A 4xx is user-correctable (show a friendly message); anything else — 5xx,
// network failure, a non-ApiError — is a service error worth logging.
export function isUserFacingError(err: unknown): boolean {
  return err instanceof ApiError && err.status < 500;
}

// The server's 400s carry a machine-readable slug in the JSON body
// (ADR 0037/0038); ApiError exposes that parsed body. Returns the slug or null.
export function apiErrorSlug(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'error' in err.body) {
    const slug = (err.body as { error: unknown }).error;
    return typeof slug === 'string' ? slug : null;
  }
  return null;
}

// The OTP submit-error mapping shared by verify-email and reset-password: a
// known code slug maps to friendly copy (not logged); anything else is the
// generic service error, logged only when it isn't a plain 4xx.
export function mapOtpSubmitError(err: unknown): { message: string; shouldLog: boolean } {
  const slug = apiErrorSlug(err);
  if (slug === 'invalid_code') return { message: OTP_INVALID_CODE, shouldLog: false };
  if (slug === 'code_expired') return { message: OTP_CODE_EXPIRED, shouldLog: false };
  return { message: SERVICE_ERROR, shouldLog: !isUserFacingError(err) };
}
