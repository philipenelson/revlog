import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createUsersRouter } from './users';
import { AppError, errorMiddleware } from '../middleware/error';
import { signAccessToken } from '../../../lib/tokens';
import type { UserService } from '../../../application/services/user.service';

process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

const profile = { id: 'user-1', fullName: 'Philip Russo', email: 'p@example.com', role: 'OWNER' };

const mockUserService: Pick<UserService, 'getCurrentUser'> = {
  getCurrentUser: vi.fn(),
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/users', createUsersRouter(mockUserService as UserService));
  app.use(errorMiddleware);
  return app;
}

let authHeader: string;

beforeAll(async () => {
  const { token } = await signAccessToken({ sub: 'user-1', accountId: 'account-1', role: 'OWNER' });
  authHeader = `Bearer ${token}`;
});

describe('GET /users/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const res = await supertest(buildApp()).get('/users/me');

    expect(res.status).toBe(401);
    expect(mockUserService.getCurrentUser).not.toHaveBeenCalled();
  });

  it('returns 200 with the profile when the request succeeds', async () => {
    (mockUserService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(profile);

    const res = await supertest(buildApp()).get('/users/me').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(profile);
  });

  it('calls getCurrentUser with the user id (sub) from the access token', async () => {
    (mockUserService.getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(profile);

    await supertest(buildApp()).get('/users/me').set('Authorization', authHeader);

    expect(mockUserService.getCurrentUser).toHaveBeenCalledOnce();
    expect(mockUserService.getCurrentUser).toHaveBeenCalledWith('user-1');
  });

  it('maps a 404 AppError to a 404 response', async () => {
    (mockUserService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new AppError(404, 'User not found'));

    const res = await supertest(buildApp()).get('/users/me').set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected service errors', async () => {
    (mockUserService.getCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB exploded'));

    const res = await supertest(buildApp()).get('/users/me').set('Authorization', authHeader);

    expect(res.status).toBe(500);
  });
});
