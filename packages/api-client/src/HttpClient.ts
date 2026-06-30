// The Port (ADR 0024). Services call this interface for all network I/O;
// each app supplies its own adapter — web's CookieHttpClient (httpOnly
// cookie auth) or mobile's TokenHttpClient (expo-secure-store + headers).
export interface RetryPolicy {
  /** Max retries after the first attempt. */
  retries: number;
  /** Base backoff before the first retry; grows by `factor` each attempt. */
  backoffMs: number;
  factor: number;
  /** Methods eligible for retry. POST is excluded by default — a timed-out write may have succeeded. */
  methods: string[];
  /** Response statuses that trigger a retry (network errors / timeouts always do, for eligible methods). */
  statuses: number[];
}

export interface RequestOptions {
  /** Per-call retry override; `false` disables retry entirely. Merged over the adapter's default. */
  retry?: Partial<RetryPolicy> | false;
  /** Abort (and, for eligible methods, retry) the request after this many ms. Off by default. */
  timeoutMs?: number;
}

// `body` is the raw JS value (or FormData) — adapters own serialization, so
// services never JSON.stringify or set Content-Type themselves.
export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}
