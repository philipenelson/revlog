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

// Interceptors are the extension point for cross-cutting concerns (auth, …).
// Both may be async — a request interceptor can await work (e.g. a token
// refresh) before the request goes out. apiFetch itself stays auth-agnostic.
export type RequestInterceptor =
  (path: string, init?: RequestInit) => Promise<[path: string, init?: RequestInit]> | [path: string, init?: RequestInit];
export type ResponseInterceptor =
  (res: Response, path: string, init?: RequestInit) => Promise<Response> | Response;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

// JSON content-type unless the body is FormData (the browser must set the
// multipart boundary). Transport-only — auth headers are added by an interceptor.
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

// The single place the network is touched — the seam a retry/timeout policy
// builds on (ADR 0022).
async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: 'include' });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let _path = path;
  let _init = init;
  for (const interceptor of requestInterceptors) {
    [_path, _init] = await interceptor(_path, _init);
  }

  let res = await sendRequest(_path, { ..._init, headers: buildHeaders(_init) });

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
