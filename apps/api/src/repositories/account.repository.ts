import type { PrismaClient } from '../generated/prisma/client';
import type { IAccountRepository, DomainAccount, AccountType } from '@maintenance-log/domain';

type AccountDb = Pick<PrismaClient, 'account'>;

export class PrismaAccountRepository implements IAccountRepository {
  constructor(private readonly db: AccountDb) {}

  async create(type: AccountType): Promise<DomainAccount> {
    return this.db.account.create({ data: { type } });
  }

  async findById(id: string): Promise<DomainAccount | null> {
    return this.db.account.findUnique({ where: { id } });
  }

  async markActive(id: string): Promise<void> {
    await this.db.account.updateMany({
      where: { id, status: 'ONBOARDING' },
      data: { status: 'ACTIVE' },
    });
  }
}
