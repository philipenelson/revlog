import bcrypt from 'bcrypt';
import type {
  RegisterInput,
  LoginInput,
  IUserRepository,
  IRefreshTokenRepository,
  IAccountRepository,
  AccountStatus,
} from '@maintenance-log/domain';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/tokens';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
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
  sendVerificationEmail(to: string, token: string, appUrl: string): Promise<void>;
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
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly emailService: IEmailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await this.userRepo.createWithAccount('PERSONAL', {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      verificationToken,
      verificationTokenExpiresAt,
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    await this.emailService.sendVerificationEmail(input.email, verificationToken, appUrl);
    logger.info({ email: input.email }, 'user registered');
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const user = await this.userRepo.findByVerificationToken(token, new Date());
    if (!user) throw new AppError(400, 'Invalid or expired verification token');

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
