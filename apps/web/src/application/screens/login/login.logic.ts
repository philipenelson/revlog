import { routeForAccountStatus } from "@/application/navigation/routeForAccountStatus";

// Pure functional core for the Login/Register screen (ADR 0043). No React, no
// I/O — every function here is deterministic and unit-tested directly. The
// useLoginViewModel hook is the thin coordination shell around these.

// Shared API-error helpers live in domain/apiError; re-exported so the hook and
// its tests import everything from one screen-logic surface.
export { isUserFacingError, SERVICE_ERROR } from "@/domain/apiError";

export const SIGN_IN_USER_ERROR =
  "Couldn't sign you in. Check your email and password — or your inbox if you haven't confirmed your account yet.";
export const REGISTER_USER_ERROR = "Couldn't create your account. Check your details and try again.";

// Constrain an untrusted `?next=` param to a same-origin path (pathname +
// search), or null if it's absent, malformed, or points off-origin — an
// open-redirect guard.
export function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, "http://localhost");
    if (url.hostname !== "localhost") return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

// Where to send a freshly-authenticated user: an explicit, safe `?next=` wins;
// otherwise route by account status. (`status` is typed off routeForAccountStatus
// so this file needs no direct schema-package import.)
export function resolvePostAuthRoute(
  nextPath: string | null,
  status: Parameters<typeof routeForAccountStatus>[0],
): string {
  return nextPath ?? routeForAccountStatus(status);
}

// The post-registration destination: the verify-email screen, carrying the
// email so the OTP screen can prefill it.
export function verifyEmailRoute(email: string): string {
  return `/verify-email?email=${encodeURIComponent(email)}`;
}
