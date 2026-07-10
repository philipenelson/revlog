import type { AccountType, AccountStatus } from '@maintenance-log/contracts';

export interface Account {
  id: string;
  type: AccountType;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}
