import { sessionStore } from '@/infrastructure/session/sessionStore';

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

export type RequestInterceptor = (path: string, init?: RequestInit) => [path: string, init?: RequestInit]
export type ResponseInterceptor = (res: Response, path: string, init?: RequestInit) => Response;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

// JSON content-type unless the body is FormData — in which case the browser must
// set the multipart boundary itself — plus the current access token if present.
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const session = sessionStore.getSession();
  if (session) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  return headers;
}

// The single place the network is touched. A future withRetry(sendRequest, …)
// with exponential backoff for timeouts/network failures wraps THIS — below the
// auth layer — so a network retry never re-runs auth logic. See ADR 0021.
async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: 'include' });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let _path = path;
  let _init = init;
  requestInterceptors.forEach((interceptor) => {
    [_path, _init] = interceptor(_path, _init);
  });

  let res = await sendRequest(_path, { ..._init, headers: buildHeaders(_init) });

  responseInterceptors.forEach((interceptor) => {
    res = interceptor(res, _path, _init);
  });

  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

function registerRequestInterceptor(interceptor: RequestInterceptor) {
  requestInterceptors.push(interceptor);
}

function registerResponseInterceptor(interceptor: ResponseInterceptor) {
  responseInterceptors.push(interceptor);
}

export {
  apiFetch,
  registerRequestInterceptor,
  registerResponseInterceptor,
};
