import type { AccountRepository } from '../domain';
import { logger } from '../lib/logger';

export class AccountService {
  constructor(private readonly accountRepo: AccountRepository) {}

  async skipOnboarding(accountId: string): Promise<void> {
    await this.accountRepo.markActive(accountId);
    logger.info({ accountId }, 'onboarding skipped');
  }
}
