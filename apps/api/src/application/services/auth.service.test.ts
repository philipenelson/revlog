import bcrypt from 'bcrypt';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import type { EmailSender } from '../ports/EmailSender';
import { JwtTokenService } from '../../adapters/token/JwtTokenService';
import { AppError } from '../../adapters/http/middleware/error';
import type { UserRepository, RefreshTokenRepository, AccountRepository, User, Account, RefreshToken } from '../../domain';

// JWT signing requires a secret at module evaluation time
process.env['JWT_SECRET'] = 'test-secret-long-enough-for-hs256';

// Real token adapter (delegates to lib/tokens); JWT_SECRET is set above.
const tokenService = new JwtTokenService();

const fixedNow = new Date('2026-01-01T00:00:00Z');

// Low rounds keep fixture hashing fast — these tests exercise our login logic, not bcrypt's cost factor
const BCRYPT_ROUNDS_FOR_FIXTURES = 4;

const mockAccount: Account = {
  id: 'account-1',
  type: 'PERSONAL',
  status: 'ONBOARDING',
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

// The plaintext OTP the fixture's hash matches. Expiry is anchored to real
// Date.now(), not fixedNow — the service (not the repo) now checks expiry, so a
// fixedNow-based expiry would read as already-lapsed against the real clock.
const CORRECT_CODE = '123456';

const mockUser: User = {
  id: 'user-1',
  accountId: 'account-1',
  fullName: 'Test User',
  email: 'test@example.com',
  passwordHash: '$2b$12$placeholder',
  role: 'OWNER',
  emailVerified: false,
  verificationCodeHash: bcrypt.hashSync(CORRECT_CODE, BCRYPT_ROUNDS_FOR_FIXTURES),
  verificationCodeExpiresAt: new Date(Date.now() + 10 * 60_000),
  verificationAttemptsRemaining: 4,
  passwordResetCodeHash: null,
  passwordResetCodeExpiresAt: null,
  passwordResetAttemptsRemaining: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const CORRECT_PASSWORD = 'SecurePass1';

const mockVerifiedUser: User = {
  ...mockUser,
  id: 'user-2',
  email: 'verified@example.com',
  passwordHash: bcrypt.hashSync(CORRECT_PASSWORD, BCRYPT_ROUNDS_FOR_FIXTURES),
  emailVerified: true,
  verificationCodeHash: null,
  verificationCodeExpiresAt: null,
  verificationAttemptsRemaining: null,
};

// A verified user with a live password-reset code (ADR 0038). Expiry is anchored
// to real Date.now() for the same reason as the verification fixture above.
const RESET_CODE = '654321';
const NEW_PASSWORD = 'BrandNewPass9';

const mockResetUser: User = {
  ...mockVerifiedUser,
  id: 'user-3',
  email: 'reset@example.com',
  passwordResetCodeHash: bcrypt.hashSync(RESET_CODE, BCRYPT_ROUNDS_FOR_FIXTURES),
  passwordResetCodeExpiresAt: new Date(Date.now() + 10 * 60_000),
  passwordResetAttemptsRemaining: 4,
};

const mockRefreshTokenRecord: RefreshToken = {
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'hashed',
  expiresAt: new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000),
  createdAt: fixedNow,
};

function makeFakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAccountId: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(mockUser),
    setVerificationCode: vi.fn().mockResolvedValue(undefined),
    decrementVerificationAttempt: vi.fn().mockResolvedValue(undefined),
    clearVerificationCode: vi.fn().mockResolvedValue(undefined),
    createWithAccount: vi.fn().mockResolvedValue({ account: mockAccount, user: mockUser }),
    markVerified: vi.fn().mockResolvedValue(undefined),
    setPasswordResetCode: vi.fn().mockResolvedValue(undefined),
    decrementPasswordResetAttempt: vi.fn().mockResolvedValue(undefined),
    clearPasswordResetCode: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeRefreshTokenRepo(overrides: Partial<RefreshTokenRepository> = {}): RefreshTokenRepository {
  return {
    create: vi.fn().mockResolvedValue(mockRefreshTokenRecord),
    findByTokenHash: vi.fn().mockResolvedValue(null),
    deleteById: vi.fn().mockResolvedValue(undefined),
    deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    create: vi.fn().mockResolvedValue(mockAccount),
    findById: vi.fn().mockResolvedValue(mockAccount),
    markActive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// An EmailSender fake with the two methods the auth flows use.
function makeEmailService(): EmailSender {
  return {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailSender;
}

const validInput = {
  fullName: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
};

describe('AuthService.register', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let emailService: EmailSender;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo();
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    emailService = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) } as unknown as EmailSender;
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);
  });

  it('throws 409 when the email is already registered', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await expect(service.register(validInput)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
    });
  });

  it('does not proceed to account creation when email is already registered', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

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

  it('sends a verification email carrying a 6-digit code to the registered address', async () => {
    await service.register(validInput);

    expect(emailService.sendVerificationEmail).toHaveBeenCalledOnce();
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      validInput.email,
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('stores a hashed code (not the plaintext), a 10-minute expiry, and 4 attempts', async () => {
    await service.register(validInput);

    const [, userData] = (userRepo.createWithAccount as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { verificationCodeHash: string; verificationCodeExpiresAt: Date; verificationAttemptsRemaining: number },
    ];
    // The plaintext emailed code never lands in the DB — only its bcrypt hash.
    const [, emailedCode] = (emailService.sendVerificationEmail as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(userData.verificationCodeHash).toMatch(/^\$2[ab]\$/);
    expect(userData.verificationCodeHash).not.toBe(emailedCode);
    expect(userData.verificationAttemptsRemaining).toBe(4);
    const ttlMs = userData.verificationCodeExpiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60_000);
  });

  it('does not send email when account creation fails', async () => {
    userRepo = makeFakeUserRepo({
      createWithAccount: vi.fn().mockRejectedValue(new Error('DB down')),
    });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await expect(service.register(validInput)).rejects.toThrow('DB down');
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.verifyEmail', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let service: AuthService;

  const validVerify = { email: mockUser.email, code: CORRECT_CODE };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
  });

  it('throws 400 code_expired for an unknown email (enumeration-safe)', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.verifyEmail({ email: 'nobody@example.com', code: CORRECT_CODE })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
  });

  it('throws 400 code_expired when the account is already verified', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.verifyEmail({ email: mockVerifiedUser.email, code: CORRECT_CODE })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
  });

  it('throws 400 code_expired when the code has expired', async () => {
    const expiredUser = { ...mockUser, verificationCodeExpiresAt: new Date(Date.now() - 1000) };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(expiredUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.verifyEmail(validVerify)).rejects.toMatchObject({ statusCode: 400, message: 'code_expired' });
  });

  it('throws 400 invalid_code and decrements the counter on a wrong code with attempts remaining', async () => {
    await expect(service.verifyEmail({ ...validVerify, code: '000000' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'invalid_code',
    });
    expect(userRepo.decrementVerificationAttempt).toHaveBeenCalledWith(mockUser.id);
    expect(userRepo.clearVerificationCode).not.toHaveBeenCalled();
  });

  it('burns the code and throws code_expired on the final (4th) wrong attempt', async () => {
    const lastAttemptUser = { ...mockUser, verificationAttemptsRemaining: 1 };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(lastAttemptUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.verifyEmail({ ...validVerify, code: '000000' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
    expect(userRepo.clearVerificationCode).toHaveBeenCalledWith(mockUser.id);
    expect(userRepo.decrementVerificationAttempt).not.toHaveBeenCalled();
  });

  it('does not mark verified or issue tokens on a wrong code', async () => {
    await expect(service.verifyEmail({ ...validVerify, code: '000000' })).rejects.toBeInstanceOf(AppError);
    expect(userRepo.markVerified).not.toHaveBeenCalled();
    expect(refreshTokenRepo.create).not.toHaveBeenCalled();
  });

  it('marks the user email as verified on the correct code', async () => {
    await service.verifyEmail(validVerify);
    expect(userRepo.markVerified).toHaveBeenCalledWith(mockUser.id);
  });

  it('looks up and returns the account associated with the user', async () => {
    const result = await service.verifyEmail(validVerify);

    expect(accountRepo.findById).toHaveBeenCalledWith(mockUser.accountId);
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('stores the hashed refresh token, not the raw token value', async () => {
    const result = await service.verifyEmail(validVerify);

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string; userId: string }];
    expect(storedData.tokenHash).not.toBe(result.refreshToken); // hash ≠ raw token
    expect(storedData.userId).toBe(mockUser.id);
  });

  it('returns a JWT access token, a raw 64-char hex refresh token, and user info', async () => {
    const result = await service.verifyEmail(validVerify);

    expect(result.accessToken).toMatch(/^eyJ/); // JWT header
    expect(result.accessTokenExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    const expiresMs = new Date(result.accessTokenExpiresAt).getTime();
    expect(expiresMs).toBeGreaterThan(Date.now());
    expect(expiresMs).toBeLessThan(Date.now() + 60 * 60 * 1000); // reflects the 15m TTL, not a far-future or epoch value
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockUser.id, accountId: mockUser.accountId, role: mockUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('the stored hash is the SHA-256 of the returned raw refresh token', async () => {
    const { createHash } = await import('crypto');
    const result = await service.verifyEmail(validVerify);

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string }];
    const expectedHash = createHash('sha256').update(result.refreshToken).digest('hex');
    expect(storedData.tokenHash).toBe(expectedHash);
  });
});

describe('AuthService.resendVerification', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let emailService: EmailSender;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    emailService = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) } as unknown as EmailSender;
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);
  });

  it('issues a fresh 6-digit code, resets expiry and attempts, and re-sends the email for an unverified user', async () => {
    await service.resendVerification({ email: mockUser.email });

    expect(userRepo.setVerificationCode).toHaveBeenCalledOnce();
    const [id, data] = (userRepo.setVerificationCode as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { codeHash: string; expiresAt: Date; attemptsRemaining: number },
    ];
    expect(id).toBe(mockUser.id);
    expect(data.codeHash).toMatch(/^\$2[ab]\$/);
    expect(data.attemptsRemaining).toBe(4);
    const ttlMs = data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60_000);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(mockUser.email, expect.stringMatching(/^\d{6}$/));
  });

  it('is a no-op for an unknown email — no code set, no email sent, still resolves', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await expect(service.resendVerification({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    expect(userRepo.setVerificationCode).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('is a no-op for an already-verified email', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await expect(service.resendVerification({ email: mockVerifiedUser.email })).resolves.toBeUndefined();
    expect(userRepo.setVerificationCode).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.forgotPassword', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let emailService: EmailSender;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    emailService = makeEmailService();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);
  });

  it('sets a fresh reset code (10-min TTL, 4 attempts) and emails it for a registered user', async () => {
    await service.forgotPassword({ email: mockVerifiedUser.email });

    expect(userRepo.setPasswordResetCode).toHaveBeenCalledOnce();
    const [id, data] = (userRepo.setPasswordResetCode as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { codeHash: string; expiresAt: Date; attemptsRemaining: number },
    ];
    expect(id).toBe(mockVerifiedUser.id);
    expect(data.codeHash).toMatch(/^\$2[ab]\$/); // hashed at rest, not the plaintext code
    expect(data.attemptsRemaining).toBe(4);
    const ttlMs = data.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60_000);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      mockVerifiedUser.email,
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('issues a code for an unverified user too (reset also verifies — ADR 0038 §6)', async () => {
    const unverified = { ...mockUser, emailVerified: false };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(unverified) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await service.forgotPassword({ email: unverified.email });

    expect(userRepo.setPasswordResetCode).toHaveBeenCalledOnce();
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('is a no-op for an unknown email — no code set, no email sent, still resolves (enumeration-safe)', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, emailService, tokenService);

    await expect(service.forgotPassword({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    expect(userRepo.setPasswordResetCode).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let service: AuthService;

  const email = makeEmailService();
  const validReset = {
    email: mockResetUser.email,
    code: RESET_CODE,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockResetUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, email, tokenService);
  });

  it('throws 400 code_expired for an unknown email (enumeration-safe)', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, email, tokenService);

    await expect(service.resetPassword({ ...validReset, email: 'nobody@example.com' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
  });

  it('throws 400 code_expired when there is no active reset code', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) }); // no reset code set
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, email, tokenService);

    await expect(service.resetPassword({ ...validReset, email: mockVerifiedUser.email })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
  });

  it('throws 400 code_expired when the code has expired', async () => {
    const expiredUser = { ...mockResetUser, passwordResetCodeExpiresAt: new Date(Date.now() - 1000) };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(expiredUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, email, tokenService);

    await expect(service.resetPassword(validReset)).rejects.toMatchObject({ statusCode: 400, message: 'code_expired' });
  });

  it('throws 400 invalid_code and decrements the counter on a wrong code with attempts remaining', async () => {
    await expect(service.resetPassword({ ...validReset, code: '000000' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'invalid_code',
    });
    expect(userRepo.decrementPasswordResetAttempt).toHaveBeenCalledWith(mockResetUser.id);
    expect(userRepo.clearPasswordResetCode).not.toHaveBeenCalled();
  });

  it('burns the code and throws code_expired on the final (4th) wrong attempt', async () => {
    const lastAttemptUser = { ...mockResetUser, passwordResetAttemptsRemaining: 1 };
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(lastAttemptUser) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, email, tokenService);

    await expect(service.resetPassword({ ...validReset, code: '000000' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'code_expired',
    });
    expect(userRepo.clearPasswordResetCode).toHaveBeenCalledWith(mockResetUser.id);
    expect(userRepo.decrementPasswordResetAttempt).not.toHaveBeenCalled();
  });

  it('does not change the password or issue tokens on a wrong code', async () => {
    await expect(service.resetPassword({ ...validReset, code: '000000' })).rejects.toBeInstanceOf(AppError);
    expect(userRepo.resetPassword).not.toHaveBeenCalled();
    expect(refreshTokenRepo.deleteAllForUser).not.toHaveBeenCalled();
    expect(refreshTokenRepo.create).not.toHaveBeenCalled();
  });

  it('sets a bcrypt-hashed new password (never the plaintext) on the correct code', async () => {
    await service.resetPassword(validReset);

    expect(userRepo.resetPassword).toHaveBeenCalledOnce();
    const [id, passwordHash] = (userRepo.resetPassword as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(id).toBe(mockResetUser.id);
    expect(passwordHash).toMatch(/^\$2[ab]\$/);
    expect(passwordHash).not.toBe(NEW_PASSWORD);
  });

  it('revokes ALL of the user\'s existing sessions before minting a new one', async () => {
    await service.resetPassword(validReset);

    expect(refreshTokenRepo.deleteAllForUser).toHaveBeenCalledWith(mockResetUser.id);
    // The new session is created after the revocation, so exactly one token is created.
    expect(refreshTokenRepo.create).toHaveBeenCalledOnce();
    const deleteOrder = (refreshTokenRepo.deleteAllForUser as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const createOrder = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('auto-signs-in: returns a JWT access token, a raw 64-char hex refresh token, user, and account', async () => {
    const result = await service.resetPassword(validReset);

    expect(result.accessToken).toMatch(/^eyJ/); // JWT header
    expect(result.accessTokenExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockResetUser.id, accountId: mockResetUser.accountId, role: mockResetUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });
});

describe('AuthService.login', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let service: AuthService;

  const validInput = { email: mockVerifiedUser.email, password: CORRECT_PASSWORD };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockVerifiedUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo();
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
  });

  it('throws 401 when no user exists for the given email', async () => {
    userRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

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
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.login(validInput)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('issues the same single 401 for "not found", "wrong password", and "unverified"', async () => {
    const notFoundRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    const wrongPasswordService = service;
    const notFoundService = new AuthService(notFoundRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
    const unverifiedRepo = makeFakeUserRepo({ findByEmail: vi.fn().mockResolvedValue({ ...mockVerifiedUser, emailVerified: false }) });
    const unverifiedService = new AuthService(unverifiedRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

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
    expect(result.accessTokenExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    const expiresMs = new Date(result.accessTokenExpiresAt).getTime();
    expect(expiresMs).toBeGreaterThan(Date.now());
    expect(expiresMs).toBeLessThan(Date.now() + 60 * 60 * 1000); // reflects the 15m TTL, not a far-future or epoch value
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockVerifiedUser.id, accountId: mockVerifiedUser.accountId, role: mockVerifiedUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });
});

describe('AuthService.refresh', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let service: AuthService;

  const RAW_TOKEN = 'c'.repeat(64);

  const mockValidRecord: RefreshToken = {
    id: 'rt-valid',
    userId: mockVerifiedUser.id,
    tokenHash: 'stored-hash-irrelevant-to-the-fake-repo',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: fixedNow,
  };

  const mockExpiredRecord: RefreshToken = {
    ...mockValidRecord,
    id: 'rt-expired',
    expiresAt: new Date(Date.now() - 1000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo({ findById: vi.fn().mockResolvedValue(mockVerifiedUser) });
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(mockValidRecord) });
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
  });

  it('throws 401 when no refresh token record matches the hash', async () => {
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.refresh(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired session',
    });
  });

  it('throws 401 when the matched record has expired', async () => {
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(mockExpiredRecord) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.refresh(RAW_TOKEN)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired session',
    });
  });

  it('issues the same single 401 for "not found" and "expired" — indistinguishable to the caller', async () => {
    const notFoundRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    const expiredRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(mockExpiredRecord) });
    const notFoundService = new AuthService(userRepo, notFoundRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
    const expiredService = new AuthService(userRepo, expiredRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    const errors = await Promise.all([
      notFoundService.refresh(RAW_TOKEN).catch((e: unknown) => e),
      expiredService.refresh(RAW_TOKEN).catch((e: unknown) => e),
    ]);

    for (const err of errors) {
      expect(err).toMatchObject({ statusCode: 401, message: 'Invalid or expired session' });
    }
  });

  it('does not look up the user when the token is not found or expired', async () => {
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.refresh(RAW_TOKEN)).rejects.toBeInstanceOf(AppError);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it('hashes the incoming raw token before looking it up — never queries with the raw value', async () => {
    const { createHash } = await import('crypto');
    await service.refresh(RAW_TOKEN);

    const expectedHash = createHash('sha256').update(RAW_TOKEN).digest('hex');
    expect(refreshTokenRepo.findByTokenHash).toHaveBeenCalledWith(expectedHash);
  });

  it('looks up the user associated with the matched record', async () => {
    await service.refresh(RAW_TOKEN);
    expect(userRepo.findById).toHaveBeenCalledWith(mockValidRecord.userId);
  });

  it('rotates the refresh token: deletes the matched record and creates a new one', async () => {
    const result = await service.refresh(RAW_TOKEN);

    expect(refreshTokenRepo.deleteById).toHaveBeenCalledWith(mockValidRecord.id);
    expect(refreshTokenRepo.create).toHaveBeenCalledOnce();
    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string; userId: string }];
    expect(storedData.userId).toBe(mockVerifiedUser.id);
    expect(storedData.tokenHash).not.toBe(result.refreshToken); // hash ≠ raw token
  });

  it('looks up and returns the account associated with the user', async () => {
    const result = await service.refresh(RAW_TOKEN);

    expect(accountRepo.findById).toHaveBeenCalledWith(mockVerifiedUser.accountId);
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('returns a JWT access token, a raw 64-char hex refresh token, and user info', async () => {
    const result = await service.refresh(RAW_TOKEN);

    expect(result.accessToken).toMatch(/^eyJ/); // JWT header
    expect(result.accessTokenExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    const expiresMs = new Date(result.accessTokenExpiresAt).getTime();
    expect(expiresMs).toBeGreaterThan(Date.now());
    expect(expiresMs).toBeLessThan(Date.now() + 60 * 60 * 1000); // reflects the 15m TTL, not a far-future or epoch value
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/); // 32 bytes as hex
    expect(result.user).toEqual({ id: mockVerifiedUser.id, accountId: mockVerifiedUser.accountId, role: mockVerifiedUser.role });
    expect(result.account).toEqual({ id: mockAccount.id, status: mockAccount.status });
  });

  it('the stored hash is the SHA-256 of the returned raw refresh token (the new, rotated value)', async () => {
    const { createHash } = await import('crypto');
    const result = await service.refresh(RAW_TOKEN);

    const [storedData] = (refreshTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0] as [{ tokenHash: string }];
    const expectedHash = createHash('sha256').update(result.refreshToken).digest('hex');
    expect(storedData.tokenHash).toBe(expectedHash);
  });
});

describe('AuthService.logout', () => {
  let userRepo: UserRepository;
  let refreshTokenRepo: RefreshTokenRepository;
  let accountRepo: AccountRepository;
  let service: AuthService;

  const RAW_TOKEN = 'd'.repeat(64);

  const mockRecord: RefreshToken = {
    id: 'rt-logout',
    userId: mockVerifiedUser.id,
    tokenHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: fixedNow,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = makeFakeUserRepo();
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(mockRecord) });
    accountRepo = makeFakeAccountRepo();
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);
  });

  it('revokes the matching refresh token by id', async () => {
    await service.logout(RAW_TOKEN);

    expect(refreshTokenRepo.findByTokenHash).toHaveBeenCalledOnce();
    expect(refreshTokenRepo.deleteById).toHaveBeenCalledWith('rt-logout');
  });

  it('hashes the raw token before looking it up — never queries with the raw value', async () => {
    const { createHash } = await import('crypto');
    await service.logout(RAW_TOKEN);

    const expectedHash = createHash('sha256').update(RAW_TOKEN).digest('hex');
    expect(refreshTokenRepo.findByTokenHash).toHaveBeenCalledWith(expectedHash);
  });

  it('is a no-op (no throw, no delete) when the token is unknown or absent — idempotent', async () => {
    refreshTokenRepo = makeFakeRefreshTokenRepo({ findByTokenHash: vi.fn().mockResolvedValue(null) });
    service = new AuthService(userRepo, refreshTokenRepo, accountRepo, { sendVerificationEmail: vi.fn() } as unknown as EmailSender, tokenService);

    await expect(service.logout(RAW_TOKEN)).resolves.toBeUndefined();
    expect(refreshTokenRepo.deleteById).not.toHaveBeenCalled();
  });
});
