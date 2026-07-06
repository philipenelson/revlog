import type { PrismaClient } from '../generated/prisma/client';
import type {
  IUserRepository,
  DomainUser,
  CreateUserData,
  NewUserRegistrationData,
  VerificationCodeData,
  PasswordResetCodeData,
  DomainAccount,
} from '@maintenance-log/domain';
import type { AccountType } from '@maintenance-log/domain';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<DomainUser | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByAccountId(accountId: string): Promise<DomainUser | null> {
    return this.db.user.findFirst({ where: { accountId } });
  }

  async findByEmail(email: string): Promise<DomainUser | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async create(data: CreateUserData): Promise<DomainUser> {
    return this.db.user.create({ data });
  }

  async setVerificationCode(id: string, data: VerificationCodeData): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        verificationCodeHash: data.codeHash,
        verificationCodeExpiresAt: data.expiresAt,
        verificationAttemptsRemaining: data.attemptsRemaining,
      },
    });
  }

  async decrementVerificationAttempt(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { verificationAttemptsRemaining: { decrement: 1 } },
    });
  }

  async clearVerificationCode(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationAttemptsRemaining: null,
      },
    });
  }

  async markVerified(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationAttemptsRemaining: null,
      },
    });
  }

  async setPasswordResetCode(id: string, data: PasswordResetCodeData): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        passwordResetCodeHash: data.codeHash,
        passwordResetCodeExpiresAt: data.expiresAt,
        passwordResetAttemptsRemaining: data.attemptsRemaining,
      },
    });
  }

  async decrementPasswordResetAttempt(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { passwordResetAttemptsRemaining: { decrement: 1 } },
    });
  }

  async clearPasswordResetCode(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetAttemptsRemaining: null,
      },
    });
  }

  async resetPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        passwordHash,
        // A valid emailed OTP proves inbox control, so a reset also verifies (ADR 0038 §6).
        emailVerified: true,
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetAttemptsRemaining: null,
      },
    });
  }

  async createWithAccount(
    accountType: AccountType,
    userData: NewUserRegistrationData,
  ): Promise<{ account: DomainAccount; user: DomainUser }> {
    return this.db.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { type: accountType } });
      const user = await tx.user.create({ data: { ...userData, accountId: account.id } });
      return { account, user };
    });
  }
}
