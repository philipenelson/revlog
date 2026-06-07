export type AccountType = 'PERSONAL';

export type AccountStatus = 'ONBOARDING' | 'ACTIVE';

export interface DomainAccount {
  id: string;
  type: AccountType;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountRepository {
  create(type: AccountType): Promise<DomainAccount>;
  findById(id: string): Promise<DomainAccount | null>;
  // Conditionally transitions ONBOARDING -> ACTIVE; no-op if already ACTIVE (idempotent, one-way).
  markActive(id: string): Promise<void>;
}
