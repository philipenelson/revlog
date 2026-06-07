import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createOnboardingRouter } from './onboarding';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../lib/tokens';
import type { AccountService } from '../services/account.service';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const mockAccountService: Pick<AccountService, 'skipOnboarding'> = {
  skipOnboarding: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/onboarding', createOnboardingRouter(mockAccountService as AccountService));
  app.use(errorMiddleware);
  return app;
}

let authHeader: string;

beforeAll(async () => {
  const token = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
});

describe('POST /onboarding/skip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).post('/onboarding/skip');

    expect(res.status).toBe(401);
    expect(mockAccountService.skipOnboarding).not.toHaveBeenCalled();
  });

  it('returns 200 with the new status when the request succeeds', async () => {
    (mockAccountService.skipOnboarding as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await supertest(buildApp()).post('/onboarding/skip').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ACTIVE' });
  });

  it('calls accountService.skipOnboarding with the accountId from the access token', async () => {
    (mockAccountService.skipOnboarding as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await supertest(buildApp()).post('/onboarding/skip').set('Authorization', authHeader);

    expect(mockAccountService.skipOnboarding).toHaveBeenCalledOnce();
    expect(mockAccountService.skipOnboarding).toHaveBeenCalledWith('account-1');
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockAccountService.skipOnboarding as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).post('/onboarding/skip').set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });

  it('forwards AppError from the service to the error middleware', async () => {
    (mockAccountService.skipOnboarding as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AppError(400, 'Something went wrong'),
    );

    const res = await supertest(buildApp()).post('/onboarding/skip').set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Something went wrong' });
  });
});
