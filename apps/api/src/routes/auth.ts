import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { registerSchema } from '@maintenance-log/domain';
import type { AuthService } from '../services/auth.service';

const REFRESH_COOKIE = 'refreshToken';

export function createAuthRouter(authService: AuthService): ExpressRouter {
  const router = Router();

  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      await authService.register(parsed.data);
      res.status(201).json({ message: 'Check your inbox to verify your email.' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    const token = typeof req.query['token'] === 'string' ? req.query['token'].trim() : '';
    if (!token) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }
    try {
      const result = await authService.verifyEmail(token);
      res.cookie(REFRESH_COOKIE, result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      res.status(200).json({ accessToken: result.accessToken, user: result.user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
