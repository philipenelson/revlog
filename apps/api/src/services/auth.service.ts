import bcrypt from 'bcrypt';
import type { RegisterInput, IUserRepository, IRefreshTokenRepository } from '@maintenance-log/domain';
import { signAccessToken, generateRefreshToken } from '../lib/tokens';
import { AppError } from '../middleware/error';
import { logger } from '../lib/logger';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = parseTtlMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

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
  refreshToken: string;
  user: { id: string; accountId: string; role: string };
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
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

    const [accessToken] = await Promise.all([
      signAccessToken({ sub: user.id, accountId: user.accountId, role: user.role }),
      this.refreshTokenRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    ]);

    logger.info({ userId: user.id }, 'email verified');
    return { accessToken, refreshToken: raw, user: { id: user.id, accountId: user.accountId, role: user.role } };
  }
}
