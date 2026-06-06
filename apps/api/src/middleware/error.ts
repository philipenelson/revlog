import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, message: err.message }, 'app error');
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error({ err }, 'unhandled error');
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : String(err);
  res.status(500).json({ error: message });
}
