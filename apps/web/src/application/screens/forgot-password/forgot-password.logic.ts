// Pure functional core for the Forgot Password screen (ADR 0043).

// Where a successful request advances to: the reset screen, carrying the email
// so the OTP screen prefills it. The endpoint is enumeration-safe (always 200),
// so this runs regardless of whether the account exists (ADR 0038).
export function resetPasswordRoute(email: string): string {
  return `/reset-password?email=${encodeURIComponent(email)}`;
}
