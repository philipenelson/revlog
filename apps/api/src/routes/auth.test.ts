import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { createAuthRouter } from './auth';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../lib/tokens';
import type { AuthService } from '../services/auth.service';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const mockAuthService: Pick<AuthService, 'register' | 'verifyEmail' | 'login' | 'refresh' | 'logout'> = {
  register: vi.fn(),
  verifyEmail: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', createAuthRouter(mockAuthService as AuthService));
  app.use(errorMiddleware);
  return app;
}

const validRegisterBody = {
  fullName: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
};

const verifyEmailResult = {
  accessToken: 'eyJmake.token.here',
  accessTokenExpiresAt: '2026-06-13T12:15:00.000Z',
  refreshToken: 'a'.repeat(64),
  user: { id: 'user-1', accountId: 'acc-1', role: 'OWNER' },
  account: { id: 'acc-1', status: 'ONBOARDING' },
};

const validLoginBody = {
  email: 'test@example.com',
  password: 'SecurePass1',
};

const loginResult = {
  accessToken: 'eyJmake.token.here',
  accessTokenExpiresAt: '2026-06-13T12:15:00.000Z',
  refreshToken: 'b'.repeat(64),
  user: { id: 'user-1', accountId: 'acc-1', role: 'OWNER' },
  account: { id: 'acc-1', status: 'ACTIVE' },
};

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 when registration succeeds', async () => {
    (mockAuthService.register as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp()).post('/auth/register').send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: expect.any(String) });
  });

  it('calls authService.register with the validated request body', async () => {
    (mockAuthService.register as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await supertest(buildApp()).post('/auth/register').send(validRegisterBody);

    expect(mockAuthService.register).toHaveBeenCalledOnce();
    expect(mockAuthService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: validRegisterBody.email, fullName: validRegisterBody.fullName }),
    );
  });

  it('returns 400 and does not call the service when body fails schema validation', async () => {
    const res = await supertest(buildApp())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('returns 400 when passwords do not match', async () => {
    const res = await supertest(buildApp())
      .post('/auth/register')
      .send({ ...validRegisterBody, confirmPassword: 'different' });

    expect(res.status).toBe(400);
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('returns 409 when service throws AppError 409', async () => {
    (mockAuthService.register as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(409, 'Email already registered'),
    );

    const res = await supertest(buildApp()).post('/auth/register').send(validRegisterBody);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'Email already registered' });
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockAuthService.register as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).post('/auth/register').send(validRegisterBody);

    expect(res.status).toBe(500);
  });
});

describe('GET /auth/verify-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when verification succeeds', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    const res = await supertest(buildApp()).get('/auth/verify-email?token=valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: verifyEmailResult.accessToken,
      accessTokenExpiresAt: verifyEmailResult.accessTokenExpiresAt,
      user: verifyEmailResult.user,
      account: verifyEmailResult.account,
    });
  });

  it('calls authService.verifyEmail with the token from the query string', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    await supertest(buildApp()).get('/auth/verify-email?token=abc123');

    expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('sets an HTTP-only cookie named refreshToken', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    const res = await supertest(buildApp()).get('/auth/verify-email?token=valid-token');

    const cookies = (res.headers['set-cookie'] ?? []) as string[];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it('does not include refreshToken in the response body for web (no X-Client-Platform header)', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    const res = await supertest(buildApp()).get('/auth/verify-email?token=valid-token');

    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('includes refreshToken in the response body when X-Client-Platform: mobile is sent (ADR 0025)', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    const res = await supertest(buildApp())
      .get('/auth/verify-email?token=valid-token')
      .set('X-Client-Platform', 'mobile');

    expect(res.body).toMatchObject({ refreshToken: verifyEmailResult.refreshToken });
  });

  it('returns 400 and does not call service when token param is missing', async () => {
    const res = await supertest(buildApp()).get('/auth/verify-email');

    expect(res.status).toBe(400);
    expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
  });

  it('trims whitespace from the token before passing it to the service', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockResolvedValue(verifyEmailResult);

    // %20 is a URL-encoded space — simulates a copy-pasted token with surrounding spaces
    await supertest(buildApp()).get('/auth/verify-email?token=%20abc123%20');

    expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('abc123');
  });

  it('returns 400 when token is only whitespace', async () => {
    const res = await supertest(buildApp()).get('/auth/verify-email?token=%20%20%20');

    expect(res.status).toBe(400);
    expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when service throws AppError 400', async () => {
    (mockAuthService.verifyEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(400, 'Invalid or expired verification token'),
    );

    const res = await supertest(buildApp()).get('/auth/verify-email?token=bad');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Invalid or expired verification token' });
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and the session payload when credentials are valid', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockResolvedValue(loginResult);

    const res = await supertest(buildApp()).post('/auth/login').send(validLoginBody);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: loginResult.accessToken,
      accessTokenExpiresAt: loginResult.accessTokenExpiresAt,
      user: loginResult.user,
      account: loginResult.account,
    });
  });

  it('calls authService.login with the validated, sanitized request body', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockResolvedValue(loginResult);

    await supertest(buildApp()).post('/auth/login').send({ email: '  Test@Example.COM  ', password: 'SecurePass1' });

    expect(mockAuthService.login).toHaveBeenCalledOnce();
    expect(mockAuthService.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com', password: 'SecurePass1' }),
    );
  });

  it('sets an HTTP-only refreshToken cookie on success', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockResolvedValue(loginResult);

    const res = await supertest(buildApp()).post('/auth/login').send(validLoginBody);

    const cookies = (res.headers['set-cookie'] ?? []) as string[];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it('does not include refreshToken in the response body for web (no X-Client-Platform header)', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockResolvedValue(loginResult);

    const res = await supertest(buildApp()).post('/auth/login').send(validLoginBody);

    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('includes refreshToken in the response body when X-Client-Platform: mobile is sent (ADR 0025)', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockResolvedValue(loginResult);

    const res = await supertest(buildApp())
      .post('/auth/login')
      .set('X-Client-Platform', 'mobile')
      .send(validLoginBody);

    expect(res.body).toMatchObject({ refreshToken: loginResult.refreshToken });
  });

  it('returns 400 and does not call the service when body fails schema validation', async () => {
    const res = await supertest(buildApp()).post('/auth/login').send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('returns 401 when the service throws AppError 401 for invalid credentials', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(401, 'Invalid email or password'),
    );

    const res = await supertest(buildApp()).post('/auth/login').send(validLoginBody);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Invalid email or password' });
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockAuthService.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).post('/auth/login').send(validLoginBody);

    expect(res.status).toBe(500);
  });
});

const refreshResult = {
  accessToken: 'eyJmake.token.here',
  accessTokenExpiresAt: '2026-06-13T12:15:00.000Z',
  refreshToken: 'd'.repeat(64),
  user: { id: 'user-1', accountId: 'acc-1', role: 'OWNER' },
  account: { id: 'acc-1', status: 'ACTIVE' },
};

describe('POST /auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and the session payload when the refresh-token cookie is valid', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=valid-raw-token']);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: refreshResult.accessToken,
      accessTokenExpiresAt: refreshResult.accessTokenExpiresAt,
      user: refreshResult.user,
      account: refreshResult.account,
    });
  });

  it('calls authService.refresh with the raw token from the cookie', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    await supertest(buildApp()).post('/auth/refresh').set('Cookie', ['refreshToken=raw-cookie-value']);

    expect(mockAuthService.refresh).toHaveBeenCalledWith('raw-cookie-value');
  });

  it('sets a new HTTP-only refreshToken cookie (rotation) on success', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=valid-raw-token']);

    const cookies = (res.headers['set-cookie'] ?? []) as string[];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain(refreshResult.refreshToken);
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it('does not include refreshToken in the response body for web (no X-Client-Platform header)', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=valid-raw-token']);

    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('includes refreshToken in the response body when X-Client-Platform: mobile is sent (ADR 0025)', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .set('Refresh-Token', 'raw-header-value');

    expect(res.body).toMatchObject({ refreshToken: refreshResult.refreshToken });
  });

  it('returns 401 and does not call the service when no refreshToken cookie or header is present', async () => {
    const res = await supertest(buildApp()).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Invalid or expired session' });
    expect(mockAuthService.refresh).not.toHaveBeenCalled();
  });

  it('falls back to the Refresh-Token header when no cookie is present (mobile, ADR 0025)', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Refresh-Token', 'raw-header-value');

    expect(res.status).toBe(200);
    expect(mockAuthService.refresh).toHaveBeenCalledWith('raw-header-value');
  });

  it('prefers the cookie over the header when both are present', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockResolvedValue(refreshResult);

    await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=cookie-value'])
      .set('Refresh-Token', 'header-value');

    expect(mockAuthService.refresh).toHaveBeenCalledWith('cookie-value');
  });

  it('returns 401 when the service throws AppError 401 for an invalid or expired token', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(401, 'Invalid or expired session'),
    );

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=stale-or-forged-token']);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Invalid or expired session' });
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockAuthService.refresh as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp())
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=valid-raw-token']);

    expect(res.status).toBe(500);
  });
});

describe('POST /auth/logout', () => {
  let authHeader: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { token } = await signAccessToken({ sub: 'user-1', accountId: 'acc-1', role: 'OWNER' });
    authHeader = `Bearer ${token}`;
  });

  it('returns 401 and does not touch the service when unauthenticated', async () => {
    const res = await supertest(buildApp())
      .post('/auth/logout')
      .set('Refresh-Token', 'c'.repeat(64));

    expect(res.status).toBe(401);
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });

  it('returns 204 and revokes the refresh token from the Refresh-Token header (mobile)', async () => {
    (mockAuthService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp())
      .post('/auth/logout')
      .set('Authorization', authHeader)
      .set('Refresh-Token', 'c'.repeat(64));

    expect(res.status).toBe(204);
    expect(mockAuthService.logout).toHaveBeenCalledWith('c'.repeat(64));
  });

  it('revokes the refresh token from the cookie (web)', async () => {
    (mockAuthService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp())
      .post('/auth/logout')
      .set('Authorization', authHeader)
      .set('Cookie', ['refreshToken=web-raw-token']);

    expect(res.status).toBe(204);
    expect(mockAuthService.logout).toHaveBeenCalledWith('web-raw-token');
  });

  it('still returns 204 when no refresh token is present, without calling the service (idempotent)', async () => {
    const res = await supertest(buildApp())
      .post('/auth/logout')
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockAuthService.logout as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp())
      .post('/auth/logout')
      .set('Authorization', authHeader)
      .set('Refresh-Token', 'c'.repeat(64));

    expect(res.status).toBe(500);
  });
});
