// Shared pure core for the mobile vehicle forms — onboarding, add-vehicle, and
// edit-vehicle (ADR 0043). No React, no I/O.

// The label a vehicle shows under: its nickname wins; otherwise "make model"
// when both are present; otherwise null.
export function vehicleDisplayLabel(nickname: string, make: string, model: string): string | null {
  const nick = nickname.trim();
  if (nick) return nick;
  const mk = make.trim();
  const md = model.trim();
  return mk && md ? `${mk} ${md}` : null;
}

// Collapse a Zod safeParse issue list into one message per top-level field
// (first issue wins) — the shape the vehicle-form viewmodels store as errors.
export function collectFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
