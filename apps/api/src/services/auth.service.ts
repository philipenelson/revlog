import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import type { RegisterInput, LoginInput, VerifyEmailInput, ResendVerificationInput, ForgotPasswordInput, ResetPasswordInput, AccountStatus } from '@maintenance-log/domain';
import type { UserRepository, RefreshTokenRepository, AccountRepository } from '../domain';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/tokens';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

const BCRYPT_ROUNDS = 12;
// Email verification OTP parameters (ADR 0037).
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_MAX_ATTEMPTS = 4;
// Password reset OTP parameters (ADR 0038). Same values as verification today,
// but named independently so the two flows can diverge without entangling.
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 4;
const REFRESH_TOKEN_TTL_MS = parseTtlMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

// Compared against on every login attempt, even when no user is found for the
// given email — without this, a missing user short-circuits before bcrypt runs,
// and the resulting timing difference lets an attacker enumerate registered emails.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  return 7 * 24 * 60 * 60 * 1000;
  }
}

export interface IEmailService {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, code: string): Promise<void>;
}

export interface VerifyEmailResult {
  accessToken: string;
  accessTokenExpiresAt: string; // ISO 8601 — when the access token's `exp` lapses
  refreshToken: string;
  user: { id: string; accountId: string; role: string };
  account: { id: string; status: AccountStatus };
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly accountRepo: AccountRepository,
    private readonly emailService: IEmailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const { code, codeHash, expiresAt } = await this.generateVerificationCode();

    await this.userRepo.createWithAccount('PERSONAL', {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      verificationCodeHash: codeHash,
      verificationCodeExpiresAt: expiresAt,
      verificationAttemptsRemaining: VERIFICATION_MAX_ATTEMPTS,
    });

    await this.emailService.sendVerificationEmail(input.email, code);
    logger.info({ email: input.email }, 'user registered');
  }

  // Verify a 6-digit OTP (ADR 0037). Lookup is by email — the code alone is not
  // globally unique. Unknown email, an already-verified account, and a
  // missing/expired/exhausted code all collapse into `code_expired`, so verify
  // is no cleaner an enumeration oracle than register's 409.
  async verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    const user = await this.userRepo.findByEmail(input.email);

    if (
      !user ||
      user.emailVerified ||
      !user.verificationCodeHash ||
      user.verificationAttemptsRemaining == null ||
      user.verificationAttemptsRemaining <= 0 ||
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date()
    ) {
      throw new AppError(400, 'code_expired');
    }

    const codeMatches = await bcrypt.compare(input.code, user.verificationCodeHash);
    if (!codeMatches) {
      // The last remaining attempt burns the code (no 5th submit is possible);
      // earlier wrong attempts just decrement the counter.
      if (user.verificationAttemptsRemaining <= 1) {
        await this.userRepo.clearVerificationCode(user.id);
        logger.info({ userId: user.id }, 'verification code burned after final wrong attempt');
        throw new AppError(400, 'code_expired');
      }
      await this.userRepo.decrementVerificationAttempt(user.id);
      throw new AppError(400, 'invalid_code');
    }

    await this.userRepo.markVerified(user.id);

    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // FK guarantees the account exists for any persisted user — accounts are never deleted in V1.
    const account = (await this.accountRepo.findById(user.accountId))!;

    const [signed] = await Promise.all([
      signAccessToken({ sub: user.id, accountId: user.accountId, role: user.role }),
      this.refreshTokenRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    ]);

    logger.info({ userId: user.id }, 'email verified');
    return {
      accessToken: signed.token,
      accessTokenExpiresAt: signed.expiresAt.toISOString(),
      refreshToken: raw,
      user: { id: user.id, accountId: user.accountId, role: user.role },
      account: { id: account.id, status: account.status },
    };
  }

  // Re-issue a fresh code, resetting expiry and the attempt counter (ADR 0037).
  // Always a no-op-but-success for an unknown or already-verified email so the
  // endpoint never reveals account state (the route returns 200 regardless).
  async resendVerification(input: ResendVerificationInput): Promise<void> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user || user.emailVerified) {
      logger.info({ email: input.email }, 'verification resend for unknown/verified email — no-op');
      return;
    }

    const { code, codeHash, expiresAt } = await this.generateVerificationCode();
    await this.userRepo.setVerificationCode(user.id, {
      codeHash,
      expiresAt,
      attemptsRemaining: VERIFICATION_MAX_ATTEMPTS,
    });

    await this.emailService.sendVerificationEmail(input.email, code);
    logger.info({ userId: user.id }, 'verification code resent');
  }

  // Request (or re-request) a password reset code (ADR 0038). Always a no-op
  // success for an unknown email — the route returns 200 regardless, so this
  // never becomes an account-enumeration oracle. A registered user gets a fresh
  // code whether or not they are verified; re-requesting replaces the prior code.
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      logger.info({ email: input.email }, 'password reset requested for unknown email — no-op');
      return;
    }

    const { code, codeHash, expiresAt } = await this.generatePasswordResetCode();
    await this.userRepo.setPasswordResetCode(user.id, {
      codeHash,
      expiresAt,
      attemptsRemaining: PASSWORD_RESET_MAX_ATTEMPTS,
    });

    await this.emailService.sendPasswordResetEmail(input.email, code);
    logger.info({ userId: user.id }, 'password reset code sent');
  }

  // Validate a reset code and set a new password (ADR 0038). Lookup is by email.
  // As with verify-email, unknown email / no active code / expired / exhausted
  // all collapse into `code_expired` so reset is no cleaner an enumeration oracle.
  // On success: set the password, mark verified, revoke ALL existing sessions,
  // then mint and return a fresh one (auto-sign-in).
  async resetPassword(input: ResetPasswordInput): Promise<VerifyEmailResult> {
    const user = await this.userRepo.findByEmail(input.email);

    if (
      !user ||
      !user.passwordResetCodeHash ||
      user.passwordResetAttemptsRemaining == null ||
      user.passwordResetAttemptsRemaining <= 0 ||
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeExpiresAt < new Date()
    ) {
      throw new AppError(400, 'code_expired');
    }

    const codeMatches = await bcrypt.compare(input.code, user.passwordResetCodeHash);
    if (!codeMatches) {
      // The last remaining attempt burns the code (no further submit is possible);
      // earlier wrong attempts just decrement the counter.
      if (user.passwordResetAttemptsRemaining <= 1) {
        await this.userRepo.clearPasswordResetCode(user.id);
        logger.info({ userId: user.id }, 'password reset code burned after final wrong attempt');
        throw new AppError(400, 'code_expired');
      }
      await this.userRepo.decrementPasswordResetAttempt(user.id);
      throw new AppError(400, 'invalid_code');
    }

    // Set the new password (also marks verified + clears the reset code, ADR 0038 §6).
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.resetPassword(user.id, passwordHash);

    // Revoke every existing session BEFORE minting the new one, so the reset logs
    // the user out of all other devices and evicts any attacker-held session.
    await this.refreshTokenRepo.deleteAllForUser(user.id);

    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // FK guarantees the account exists for any persisted user — accounts are never deleted in V1.
    const account = (await this.accountRepo.findById(user.accountId))!;

    const [signed] = await Promise.all([
      signAccessToken({ sub: user.id, accountId: user.accountId, role: user.role }),
      this.refreshTokenRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    ]);

    logger.info({ userId: user.id }, 'password reset completed');
    return {
      accessToken: signed.token,
      accessTokenExpiresAt: signed.expiresAt.toISOString(),
      refreshToken: raw,
      user: { id: user.id, accountId: user.accountId, role: user.role },
      account: { id: account.id, status: account.status },
    };
  }

  // A CSPRNG 6-digit code (zero-padded) plus its bcrypt hash and expiry. The
  // plaintext is returned only to be emailed; only the hash is ever persisted.
  private async generateVerificationCode(): Promise<{ code: string; codeHash: string; expiresAt: Date }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
    return { code, codeHash, expiresAt };
  }

  // Same construction as generateVerificationCode, but with the reset TTL — kept
  // separate so the two OTP flows stay independent (ADR 0038 §3).
  private async generatePasswordResetCode(): Promise<{ code: string; codeHash: string; expiresAt: Date }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);
    return { code, codeHash, expiresAt };
  }

  async login(input: LoginInput): Promise<VerifyEmailResult> {
    const user = await this.userRepo.findByEmail(input.email);
    const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    // Single error for "no such user", "wrong password", and "unverified" — collapsing
    // them prevents an attacker from enumerating registered or verified emails.
    if (!user || !passwordMatches || !user.emailVerified) {
      throw new AppError(401, 'Invalid email or password');
    }

    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // FK guarantees the account exists for any persisted user — accounts are never deleted in V1.
    const account = (await this.accountRepo.findById(user.accountId))!;

    const [signed] = await Promise.all([
      signAccessToken({ sub: user.id, accountId: user.accountId, role: user.role }),
      this.refreshTokenRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    ]);

    logger.info({ userId: user.id }, 'user logged in');
    return {
      accessToken: signed.token,
      accessTokenExpiresAt: signed.expiresAt.toISOString(),
      refreshToken: raw,
      user: { id: user.id, accountId: user.accountId, role: user.role },
      account: { id: account.id, status: account.status },
    };
  }

  async refresh(rawToken: string): Promise<VerifyEmailResult> {
    const record = await this.refreshTokenRepo.findByTokenHash(hashRefreshToken(rawToken));

    // "Not found" and "expired" collapse into the same 401 — see ADR 0017 ("Reuse
    // detection"): a garbage, forged, expired, or already-rotated token must be
    // indistinguishable to the caller.
    if (!record || record.expiresAt < new Date()) {
      throw new AppError(401, 'Invalid or expired session');
    }

    // FK guarantees the user exists for any persisted RefreshToken row — users are never deleted in V1.
    const user = (await this.userRepo.findById(record.userId))!;
    // FK guarantees the account exists for any persisted user — accounts are never deleted in V1.
    const account = (await this.accountRepo.findById(user.accountId))!;

    const { raw, hash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Rotation: delete the old row and insert a new one (ADR 0012 / ADR 0017) — keeps
    // "is this token still valid" and "replace it" as separate, individually-failable steps.
    const [signed] = await Promise.all([
      signAccessToken({ sub: user.id, accountId: user.accountId, role: user.role }),
      this.refreshTokenRepo.deleteById(record.id),
      this.refreshTokenRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    ]);

    logger.info({ userId: user.id }, 'session refreshed');
    return {
      accessToken: signed.token,
      accessTokenExpiresAt: signed.expiresAt.toISOString(),
      refreshToken: raw,
      user: { id: user.id, accountId: user.accountId, role: user.role },
      account: { id: account.id, status: account.status },
    };
  }

  // Revoke a refresh token (mobile logout, ADR 0034). Idempotent: an
  // unknown/absent token is a no-op success — logout must never fail because
  // the token was already gone, and it never discloses whether one existed.
  async logout(rawToken: string): Promise<void> {
    const record = await this.refreshTokenRepo.findByTokenHash(hashRefreshToken(rawToken));
    if (record) {
      await this.refreshTokenRepo.deleteById(record.id);
      logger.info({ userId: record.userId }, 'user logged out');
    }
  }
}
