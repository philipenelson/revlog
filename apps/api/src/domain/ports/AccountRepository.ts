import type { AccountType } from '@maintenance-log/contracts';
import type { Account } from '../models/Account';

export interface AccountRepository {
  create(type: AccountType): Promise<Account>;
  findById(id: string): Promise<Account | null>;
  // Conditionally transitions ONBOARDING -> ACTIVE; no-op if already ACTIVE (idempotent, one-way).
  markActive(id: string): Promise<void>;
}
