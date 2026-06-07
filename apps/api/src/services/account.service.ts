import type { IAccountRepository } from '@maintenance-log/domain';
import { logger } from '../lib/logger';

export class AccountService {
  constructor(private readonly accountRepo: IAccountRepository) {}

  async skipOnboarding(accountId: string): Promise<void> {
    await this.accountRepo.markActive(accountId);
    logger.info({ accountId }, 'onboarding skipped');
  }
}
