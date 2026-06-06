import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/tokens';
import { AppError } from './error';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid authorization header'));
  }
  const token = header.slice(7);
  try {
    req.auth = await verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired access token'));
  }
}
