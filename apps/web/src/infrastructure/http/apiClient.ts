const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown when our own timeout aborts a request (retryable). A caller-supplied signal abort is not. */
export class TimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "TimeoutError";
  }
}

// Interceptors are the extension point for cross-cutting concerns (auth, …).
// Both may be async — a request interceptor can await work (e.g. a token
// refresh) before the request goes out. apiFetch itself stays auth-agnostic.
export type RequestInterceptor =
  (path: string, init?: RequestInit) => Promise<[path: string, init?: RequestInit]> | [path: string, init?: RequestInit];
export type ResponseInterceptor =
  (res: Response, path: string, init?: RequestInit) => Promise<Response> | Response;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

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
  /** Per-call retry override; `false` disables retry entirely. Merged over the global default. */
  retry?: Partial<RetryPolicy> | false;
  /** Abort (and, for eligible methods, retry) the request after this many ms. Off by default. */
  timeoutMs?: number;
}

const DEFAULT_RETRY: RetryPolicy = {
  retries: 2,
  backoffMs: 300,
  factor: 2,
  methods: ["GET", "HEAD", "PUT", "DELETE"],
  statuses: [502, 503, 504],
};

let defaultRetry: RetryPolicy = DEFAULT_RETRY;
let defaultTimeoutMs: number | undefined;

/** Set the process-wide retry/timeout defaults once; per-call `options` still override. */
export function setDefaultRequestOptions(options: { retry?: Partial<RetryPolicy>; timeoutMs?: number }): void {
  if (options.retry) defaultRetry = { ...defaultRetry, ...options.retry };
  if ("timeoutMs" in options) defaultTimeoutMs = options.timeoutMs;
}

// JSON content-type unless the body is FormData (the browser must set the
// multipart boundary). Transport-only — auth headers are added by an interceptor.
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function resolveRetry(method: string | undefined, retry: RequestOptions["retry"]): RetryPolicy | null {
  if (retry === false) return null;
  const policy = { ...defaultRetry, ...(retry ?? {}) };
  const m = (method ?? "GET").toUpperCase();
  return policy.methods.some((allowed) => allowed.toUpperCase() === m) ? policy : null;
}

// A network failure (fetch rejects with TypeError) or our own timeout is
// retryable; a caller-initiated AbortError is not (the caller cancelled).
function isRetryableError(err: unknown): boolean {
  return err instanceof TimeoutError || err instanceof TypeError;
}

// One network attempt, with an optional timeout. Honours a caller-supplied
// signal and normalises a timeout abort to a retryable TimeoutError.
async function sendOnce(path: string, init: RequestInit, timeoutMs: number | undefined): Promise<Response> {
  if (!timeoutMs) {
    return fetch(`${API_URL}${path}`, { ...init, credentials: 'include' });
  }
  const controller = new AbortController();
  let timedOut = false;
  const callerSignal = init.signal ?? undefined;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', signal: controller.signal });
  } catch (err) {
    if (timedOut) throw new TimeoutError();
    throw err; // caller abort or network error — propagate as-is
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }
}

// The seam every request funnels through: timeout + retry/backoff for transient
// failures, below the interceptor pipeline so a retry never re-runs auth (ADR 0022).
async function sendRequest(path: string, init: RequestInit, options?: RequestOptions): Promise<Response> {
  const policy = resolveRetry(init.method, options?.retry);
  const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;

  let attempt = 0;
  for (;;) {
    try {
      const res = await sendOnce(path, init, timeoutMs);
      if (policy && attempt < policy.retries && policy.statuses.includes(res.status)) {
        attempt += 1;
        await delay(policy.backoffMs * policy.factor ** (attempt - 1));
        continue;
      }
      return res;
    } catch (err) {
      if (policy && attempt < policy.retries && isRetryableError(err)) {
        attempt += 1;
        await delay(policy.backoffMs * policy.factor ** (attempt - 1));
        continue;
      }
      throw err;
    }
  }
}

async function apiFetch<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  let _path = path;
  let _init = init;
  for (const interceptor of requestInterceptors) {
    [_path, _init] = await interceptor(_path, _init);
  }

  let res = await sendRequest(_path, { ..._init, headers: buildHeaders(_init) }, options);

  for (const interceptor of responseInterceptors) {
    res = await interceptor(res, _path, _init);
  }

  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

// Registration returns an unregister fn so callers (e.g. AuthProvider) can clean
// up and never accumulate handlers across remounts.
function registerRequestInterceptor(interceptor: RequestInterceptor): () => void {
  requestInterceptors.push(interceptor);
  return () => {
    const i = requestInterceptors.indexOf(interceptor);
    if (i !== -1) requestInterceptors.splice(i, 1);
  };
}

function registerResponseInterceptor(interceptor: ResponseInterceptor): () => void {
  responseInterceptors.push(interceptor);
  return () => {
    const i = responseInterceptors.indexOf(interceptor);
    if (i !== -1) responseInterceptors.splice(i, 1);
  };
}

export {
  apiFetch,
  registerRequestInterceptor,
  registerResponseInterceptor,
};
