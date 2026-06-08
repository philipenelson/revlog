import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createAuthRouter } from './auth';
import { AppError, errorMiddleware } from '../middleware/error';
import type { AuthService } from '../services/auth.service';

const mockAuthService: Pick<AuthService, 'register' | 'verifyEmail' | 'login'> = {
  register: vi.fn(),
  verifyEmail: vi.fn(),
  login: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
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
