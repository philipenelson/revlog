import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { registerSchema, loginSchema, verifyEmailSchema, resendVerificationSchema } from '@maintenance-log/domain';
import type { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

// Mobile has no cookie jar (ADR 0025), so it identifies itself with this
// header and receives the refresh token directly in the response body
// instead of (only) the httpOnly cookie. Web never sends this header, so
// its responses are unchanged.
const isMobileClient = (req: Request): boolean => req.header('x-client-platform') === 'mobile';

interface SessionResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: unknown;
  account: unknown;
}

function sessionResponseBody(result: SessionResult, req: Request) {
  return {
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt,
    user: result.user,
    account: result.account,
    ...(isMobileClient(req) ? { refreshToken: result.refreshToken } : {}),
  };
}

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

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const result = await authService.login(parsed.data);
      res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json(sessionResponseBody(result, req));
    } catch (err) {
      next(err);
    }
  });

  // OTP verification (ADR 0037): body { email, code }, replaces the old
  // GET ?token= link. On success it auto-signs the User in, exactly as the
  // link path did — same cookie/body token handling as /login.
  router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      const result = await authService.verifyEmail(parsed.data);
      res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json(sessionResponseBody(result, req));
    } catch (err) {
      next(err);
    }
  });

  // Re-issue a verification code. Always 200 regardless of whether the email is
  // registered or already verified — the endpoint must not disclose account
  // state (enumeration-safe, ADR 0037). The service is a no-op in those cases.
  router.post('/verify-email/resend', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }
    try {
      await authService.resendVerification(parsed.data);
      res.status(200).json({ message: 'If that account needs verifying, a new code is on its way.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    // Web sends the refresh token as an httpOnly cookie. Mobile has no cookie
    // jar (ADR 0025), so it sends a Refresh-Token header instead — checked
    // only when no cookie is present; the web path is unchanged.
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.headers['refresh-token'];
    if (typeof token !== 'string' || !token) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    try {
      const result = await authService.refresh(token);
      res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json(sessionResponseBody(result, req));
    } catch (err) {
      next(err);
    }
  });

  // Online-required logout (ADR 0034): revoke the caller's refresh token
  // server-side. Behind `authenticate`, but idempotent — an absent/unknown
  // refresh token still returns 204. Refresh token source mirrors /refresh:
  // web cookie or (mobile) Refresh-Token header.
  router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.headers['refresh-token'];
    try {
      if (typeof token === 'string' && token) {
        await authService.logout(token);
      }
      res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
