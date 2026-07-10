import { apiFetch, registerRequestInterceptor, registerResponseInterceptor } from "./apiClient";
import type { HttpClient, RequestOptions } from "@maintenance-log/api-client/HttpClient";

// FormData passes through untouched (the runtime sets the multipart
// boundary); everything else is JSON-serialized here so services never call
// JSON.stringify themselves. apiFetch itself stays content-type agnostic.
function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

// Web adapter for the HttpClient port (ADR 0024) — wraps the existing
// apiFetch transport. Auth is transparent: the httpOnly refreshToken cookie
// is sent automatically by the browser, and the Bearer access token is
// attached by the interceptor pipeline AuthProvider registers below.
export const cookieHttpClient: HttpClient = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { method: "POST", body: serializeBody(body) }, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { method: "PATCH", body: serializeBody(body) }, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { method: "PUT", body: serializeBody(body) }, options),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { method: "DELETE" }, options),
};

export { registerRequestInterceptor, registerResponseInterceptor };
