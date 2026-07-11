import { ApiError } from "@maintenance-log/api-client";

// Pure core for the incoming-transfer screen (ADR 0043).

export type TransferLoadOutcome = "not-found" | "error";

// A 404 means the transfer token is unknown/consumed (show not-found); any
// other load failure is a genuine error worth logging.
export function classifyTransferLoadError(err: unknown): TransferLoadOutcome {
  return err instanceof ApiError && err.status === 404 ? "not-found" : "error";
}

// The message for a failed accept/decline: an ApiError surfaces its own message
// (with a per-action fallback); anything else is a generic retry prompt.
export function transferActionError(err: unknown, apiFallback: string): string {
  if (err instanceof ApiError) return err.message ?? apiFallback;
  return "Something went wrong. Try again.";
}
