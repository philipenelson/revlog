import type { PrismaClient } from '../generated/prisma/client';
import type {
  IUserRepository,
  DomainUser,
  CreateUserData,
  NewUserRegistrationData,
  DomainAccount,
} from '@maintenance-log/domain';
import type { AccountType } from '@maintenance-log/domain';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<DomainUser | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<DomainUser | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async findByVerificationToken(token: string, now: Date): Promise<DomainUser | null> {
    return this.db.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiresAt: { gt: now },
      },
    });
  }

  async create(data: CreateUserData): Promise<DomainUser> {
    return this.db.user.create({ data });
  }

  async markVerified(id: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
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
