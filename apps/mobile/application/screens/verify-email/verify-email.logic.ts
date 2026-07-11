// Pure functional core for the Verify Email screen (ADR 0043).

// A 6-digit numeric OTP: strip everything non-numeric and cap at 6 so paste and
// autofill can't push a malformed value past the client gate.
export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

// The code is submittable once it is exactly 6 digits.
export function isCompleteOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
