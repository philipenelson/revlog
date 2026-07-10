import type { PrismaClient } from '../generated/prisma/client';
import type { AccountType } from '@maintenance-log/domain';
import type { AccountRepository, Account } from '../domain';

type AccountDb = Pick<PrismaClient, 'account'>;

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: AccountDb) {}

  async create(type: AccountType): Promise<Account> {
    return this.db.account.create({ data: { type } });
  }

  async findById(id: string): Promise<Account | null> {
    return this.db.account.findUnique({ where: { id } });
  }

  async markActive(id: string): Promise<void> {
    await this.db.account.updateMany({
      where: { id, status: 'ONBOARDING' },
      data: { status: 'ACTIVE' },
    });
  }
}
