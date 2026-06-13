import { sessionService } from '@/model/services/sessionService';

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

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${sessionService.getSession()?.accessToken}` },
    body: formData,
  });

  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

export type RequestInterceptor = (path: string, init?: RequestInit) => [path: string, init?: RequestInit]
export type ResponseInterceptor = (res: Response, path: string, init?: RequestInit) => Response;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let _path = path;
  let _init = init;
  requestInterceptors.forEach((interceptor) => {
    [_path, _init] = interceptor(_path, _init);
  })
  const headers = new Headers({
    'Content-Type': 'application/json',
    ..._init?.headers,
  });

  const session = sessionService.getSession();
  if (session) {
    headers.append('Authorization', `Bearer ${session.accessToken}`);
  }
  const reqOptions: RequestInit = {
    ..._init,
    credentials: 'include',
    headers: headers,
  };

  let res = await fetch(`${API_URL}${_path}`, reqOptions);

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