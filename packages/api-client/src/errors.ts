// Part of the HttpClient port's contract: every adapter throws these on
// failure so shared services (and the apps that call them) can rely on a
// single `instanceof` check regardless of which adapter is in use.
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Thrown when an adapter's own timeout aborts a request (retryable). A caller-supplied signal abort is not. */
export class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'TimeoutError';
  }
}
