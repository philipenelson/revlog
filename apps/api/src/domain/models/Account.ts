import type { AccountType, AccountStatus } from '@maintenance-log/domain';

export interface Account {
  id: string;
  type: AccountType;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}
