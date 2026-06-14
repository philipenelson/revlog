# HTTP client retry and timeout policy

## Context

The web `apiFetch` ([ADR 0021](./0021-proactive-access-token-refresh.md)) is a generic transport with an async interceptor pipeline. It had no resilience to transient failures: a dropped connection or a hung request surfaced immediately as a thrown error to the calling viewmodel, with no retry and no timeout (`fetch` has none by default).

We want flaky-network resilience without sprinkling a `withRetry(...)` wrapper at every call site, and without coupling it to the auth interceptors. Two shapes were considered:

1. **A response interceptor that retries.** Rejected: a timeout or network error makes `fetch` *reject* — there is no `Response`, so a response interceptor never runs for exactly the failures we want to retry. It could only retry a 5xx *Response*, not the dropped-connection/timeout case.
2. **Built into the client, default-on, configurable per call.** Chosen — this is how mature clients (ky, got, axios-retry) do it.

## Decision

### Retry wraps the `sendRequest` seam — below the interceptors

Retry and timeout live in `sendRequest` (the single place `apiFetch` touches the network — [ADR 0021](./0021-proactive-access-token-refresh.md)), *beneath* the interceptor pipeline. The request interceptors run **once** to prepare the request (token attached); a retry re-sends that already-prepared request. So a network retry never re-runs the auth interceptor or churns a token refresh, and transport resilience stays cleanly separate from auth.

### Default-on, but only for idempotent methods

Auto-retrying a timeout is safe for **idempotent** methods (GET/HEAD/PUT/DELETE) — re-sending changes nothing. For **POST** a timeout usually means the *response* was lost, not that the server skipped the work, so a blind retry risks **duplicate writes** (two vehicles, two log entries). The default therefore retries idempotent methods only; POST is excluded and must be opted in per-call (only safe for idempotency-keyed endpoints). got and axios-retry default the same way.

Retry triggers on: network errors (`fetch` rejecting with `TypeError`), our own timeout aborts, and configurable gateway statuses (default `502, 503, 504`). Backoff is exponential (`backoffMs * factor^(attempt-1)`).

### Timeout via `AbortController`, opt-in

A per-request timeout is implemented with an `AbortController` (manual `setTimeout`, for broad browser support rather than `AbortSignal.timeout`/`any`). A timeout-driven abort is normalised to a retryable `TimeoutError`; a **caller-supplied** `signal` that aborts is propagated unchanged and is **never** retried (the caller cancelled deliberately).

The default timeout is **off** (`undefined`). A global default would risk aborting legitimately long requests — notably multipart photo uploads (POST, not retried anyway). Timeout is enabled globally or per-call when wanted; "retry on timeout" only applies once a timeout is set.

### Configurable per-call and globally

`apiFetch(path, init?, options?)` gains a third argument carrying client-specific options kept *separate* from the Fetch-standard `RequestInit`:

```ts
interface RequestOptions {
  retry?: Partial<RetryPolicy> | false;   // false disables; partial overrides the default
  timeoutMs?: number;
}
interface RetryPolicy {
  retries: number;        // default 2
  backoffMs: number;      // default 300
  factor: number;         // default 2
  methods: string[];      // default ['GET','HEAD','PUT','DELETE']
  statuses: number[];     // default [502, 503, 504]
}
```

A module-level default policy is set once (`setDefaultRequestOptions`) and merged with per-call overrides, so the policy is defined in one place and tuned where needed.

## Status

accepted

## Consequences

- Transient network failures and configured gateway 5xx on idempotent requests are retried transparently with exponential backoff — no per-call decoration.
- POST is not auto-retried, so a lost mutation response never duplicates a write; callers opt in only for idempotency-keyed endpoints.
- Retry sits below the interceptor pipeline at the `sendRequest` seam, so it never re-runs auth or refresh.
- A caller-supplied `AbortSignal` cancellation is honoured and never retried; only our own timeout is retryable.
- Network/timeout failures still surface to callers as thrown errors (`TypeError`/`TimeoutError`) once retries are exhausted — viewmodels' existing non-`ApiError` handling (the generic service-error message) covers them unchanged.

## V2+ items

- **Jitter** on the backoff to avoid thundering-herd retries — plain exponential for V1; the `RetryPolicy` shape can carry it later.
- **Idempotency keys** for safe POST retries — would let mutations opt into retry without duplicate-write risk.
