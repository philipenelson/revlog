import bcrypt from 'bcrypt';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import type { IEmailService } from './auth.service';
import { AppError } from '../middleware/error';
import type {
  IUserRepository,
  IRefreshTokenRepository,
  IAccountRepository,
  DomainUser,
  DomainAccount,
  DomainRefreshToken,
} from '@maintenance-log/domain';

// JWT signing requires a secret at module evaluation time
process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';
process.env['APP_URL'] = 'http://localhost:3000';

const fixedNow = new Date('2026-01-01T00:00:00Z');

// Low rounds keep fixture hashing fast — these tests exercise our login logic, not bcrypt's cost factor
const BCRYPT_ROUNDS_FOR_FIXTURES = 4;

const mockAccount: DomainAccount = {
  id: 'account-1',
  type: 'PERSONAL',
  status: 'ONBOARDING',
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const mockUser: DomainUser = {
  id: 'user-1',
  accountId: 'account-1',
  fullName: 'Test User',
  email: 'test@example.com',
  passwordHash: '$2b$12$placeholder',
  role: 'OWNER',
  emailVerified: false,
  verificationToken: 'tok-abc',
  verificationTokenExpiresAt: new Date(fixedNow.getTime() + 60_000),
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const CORRECT_PASSWORD = 'SecurePass1';

const mockVerifiedUser: DomainUser = {
  ...mockUser,
  id: 'user-2',
  email: 'verified@example.com',
  passwordHash: bcrypt.hashSync(CORRECT_PASSWORD, BCRYPT_ROUNDS_FOR_FIXTURES),
  emailVerified: true,
  verificationToken: null,
  verificationTokenExpiresAt: null,
};

const mockRefreshTokenRecord: DomainRefreshToken = {
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'hashed',
  expiresAt: new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000),
  createdAt: fixedNow,
};

function makeFakeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByVerificationToken: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockUser),
    createWithAccount: vi.fn().mockResolvedValue({ account: mockAccount, user: mockUser }),
    markVerified: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeRefreshTokenRepo(overrides: Partial<IRefreshTokenRepository> = {}): IRefreshTokenRepository {
  return {
    create: vi.fn().mockResolvedValue(mockRefreshTokenRecord),
    findByTokenHash: vi.fn().mockResolvedValue(null),
    deleteById: vi.fn().mockResolvedValue(undefined),
    deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeAccountRepo(overrides: Partial<IAccountRepository> = {}): IAccountRepository {
  return {
    create: vi.fn().mockResolvedValue(mockAccount),
    findById: vi.fn().mockResolvedValue(mockAccount),
    markActive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const validInput = {
  fullName: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
};

describe('AuthService.register', () => {
  let userRepo: IUserRepository;
  let refreshTokenRepo: IRefreshTokenRepository;
  let accountRepo: IAccountRepository;
  let emailService: IEmailService;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo();
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    emailService = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) } as unknown as IEmailService;
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService);
  });

  it('throws 409 when the email is already registered', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
    });
  });

  it('does not proceed to account creation when email is already registered', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService);

    await expect(service.register(validInput)).rejects.toBeInstanceOf(AppError);
    expect(userRepo.createWithAccount).not.toHaveBeenCalled();
  });

  it('creates account and user atomically using createWithAccount', async () => {
    await service.register(validInput);

    expect(userRepo.createWithAccount).toHaveBeenCalledOnce();
    expect(userRepo.createWithAccount).toHaveBeenCalledWith(
      'PERSONAL',
      expect.objectContaining({
        fullName: validInput.fullName,
        email: validInput.email,
      }),
    );
  });

  it('stores a bcrypt-hashed password, not the plain-text value', async () => {
    await service.register(validInput);

    const [, userData] = (userRepo.createWithAccount as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { passwordHash: string }];
    expect(userData.passwordHash).not.toBe(validInput.password);
    expect(userData.passwordHash).toMatch(/^\$2[ab]\$/); // bcrypt prefix
  });

  it('sends a verification email to the registered address', async () => {
    await service.register(validInput);

    expect(emailService.sendVerificationEmail).toHaveBeenCalledOnce();
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      validInput.email,
      expect.any(String),
      'http://localhost:3000',
    );
  });

  it('does not send email when account creation fails', async () => {
    userRepo = makeFakeUserRepo({
      createWithAccount: vi.fn().mockRejectedValue(new Error('DB down')),
    });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService);

    await expect(service.register(validInput)).rejects.toThrow('DB down');
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.verifyEmail', () => {
  let userRepo: IUserRepository;
  let refreshTokenRepo: IRefreshTokenRepository;
  let accountRepo: IAccountRepository;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({
      findByVerificationToken: vi.fn().mockResolvedValue(mockUser),
    });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);
  });

  it('throws 400 when the token is not found or expired', async () => {
    userRepo = makeFakeUserRepo({ findByVerificationToken: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);

    await expect(service.verifyEmail('bad-token')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired verification token',
    });
  });

  it('marks the user email as verified', async () => {
    await service.verifyEmail('tok-abc');
    expect(userRepo.markVerified).toHaveBeenCalledWith(mockUser.id);
  });

  it('looks up and returns the account associated with the user', async () => {
    const result = await service.verifyEmail('tok-abc');

    expect(accountRepo.findById).toHaveBeenCalledWith(mockUser.accountId);
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('stores the hashed refresh token, not the raw token value', async () => {
    const result = await service.verifyEmail('tok-abc');

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string; userId: string }];
    expect(storedData.tokenHash).not.toBe(result.refreshToken); // hash ≠ raw token
    expect(storedData.userId).toBe(mockUser.id);
  });

  it('returns a JWT access token, a raw 64-char hex refresh token, and user info', async () => {
    const result = await service.verifyEmail('tok-abc');

    expect(result.accessToken).toMatch(/^eyJ/); // JWT header
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockUser.id, accountId: mockUser.accountId, role: mockUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('the stored hash is the SHA-256 of the returned raw refresh token', async () => {
    const { createHash } = await import('crypto');
    const result = await service.verifyEmail('tok-abc');

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string }];
    const expectedHash = createHash('sha256').update(result.refreshToken).digest('hex');
    expect(storedData.tokenHash).toBe(expectedHash);
  });
});

describe('AuthService.login', () => {
  let userRepo: IUserRepository;
  let refreshTokenRepo: IRefreshTokenRepository;
  let accountRepo: IAccountRepository;
  let service: AuthService;

  const validInput = { email: mockVerifiedUser.email, password: CORRECT_PASSWORD };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);
  });

  it('throws 401 when no user exists for the given email', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);

    await expect(service.login(validInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws 401 when the password does not match', async () => {
    await expect(service.login({ ...validInput, password: 'WrongPass1' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws 401 when the user exists and the password matches but the email is unverified', async () => {
    const unverifiedUser = { ...mockVerifiedUser, emailVerified: false };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(unverifiedUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);

    await expect(service.login(validInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('issues the same single 401 for "not found", "wrong password", and "unverified"', async () => {
    const notFoundRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    const wrongPasswordService = service;
    const notFoundService = new AuthService(notFoundRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);
    const unverifiedRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue({ ...mockVerifiedUser, emailVerified: false }) });
    const unverifiedService = new AuthService(unverifiedRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as IEmailService);

    const errors = await Promise.all([
      notFoundService.login(validInput).catch((e: unknown) => e),
      wrongPasswordService.login({ ...validInput, password: 'WrongPass1' }).catch((e: unknown) => e),
      unverifiedService.login(validInput).catch((e: unknown) => e),
    ]);

    for (const err of errors) {
      expect(err).toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    }
  });

  it('looks up and returns the account associated with the user', async () => {
    const result = await service.login(validInput);

    expect(accountRepo.findById).toHaveBeenCalledWith(mockVerifiedUser.accountId);
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('stores the hashed refresh token, not the raw token value', async () => {
    const result = await service.login(validInput);

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string; userId: string }];
    expect(storedData.tokenHash).not.toBe(result.refreshToken);
    expect(storedData.userId).toBe(mockVerifiedUser.id);
  });

  it('returns a JWT access token, a raw 64-char hex refresh token, and user info', async () => {
    const result = await service.login(validInput);

    expect(result.accessToken).toMatch(/^eyJ/); // JWT header
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockVerifiedUser.id, accountId: mockVerifiedUser.accountId, role: mockVerifiedUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });
});
