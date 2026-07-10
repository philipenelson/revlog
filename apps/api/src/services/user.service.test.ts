import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';
import type { UserRepository, User } from '../domain';
import { AppError } from '../middleware/error';

const fixedNow = new Date('2026-01-01T00:00:00Z');

const mockUser: User = {
  id: 'user-1',
  accountId: 'account-1',
  fullName: 'Philip Russo',
  email: 'p@example.com',
  passwordHash: 'hashed-secret',
  role: 'OWNER',
  emailVerified: true,
  verificationCodeHash: null,
  verificationCodeExpiresAt: null,
  verificationAttemptsRemaining: null,
  passwordResetCodeHash: null,
  passwordResetCodeExpiresAt: null,
  passwordResetAttemptsRemaining: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

function makeFakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(mockUser),
    findByAccountId: vi.fn().mockResolvedValue(mockUser),
    findByEmail: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    setVerificationCode: vi.fn().mockResolvedValue(undefined),
    decrementVerificationAttempt: vi.fn().mockResolvedValue(undefined),
    clearVerificationCode: vi.fn().mockResolvedValue(undefined),
    markVerified: vi.fn().mockResolvedValue(undefined),
    setPasswordResetCode: vi.fn().mockResolvedValue(undefined),
    decrementPasswordResetAttempt: vi.fn().mockResolvedValue(undefined),
    clearPasswordResetCode: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    createWithAccount: vi.fn(),
    ...overrides,
  };
}

describe('UserService.getCurrentUser', () => {
  let userRepo: UserRepository;
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo();
    service = new UserService(userRepo);
  });

  it('returns the public profile for the given user id', async () => {
    const profile = await service.getCurrentUser('user-1');

    expect(userRepo.findById).toHaveBeenCalledWith('user-1');
    expect(profile).toEqual({
      id: 'user-1',
      fullName: 'Philip Russo',
      email: 'p@example.com',
      role: 'OWNER',
    });
  });

  it('never leaks passwordHash or other sensitive fields', async () => {
    const profile = await service.getCurrentUser('user-1');

    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('verificationCodeHash');
    expect(Object.keys(profile).sort()).toEqual(['email', 'fullName', 'id', 'role']);
  });

  it('throws 404 when the user row no longer exists', async () => {
    userRepo = makeFakeUserRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new UserService(userRepo);

    await expect(service.getCurrentUser('ghost')).rejects.toBeInstanceOf(AppError);
    await expect(service.getCurrentUser('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});
