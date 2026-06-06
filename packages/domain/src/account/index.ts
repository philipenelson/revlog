export type AccountType = 'PERSONAL';

export interface DomainAccount {
  id: string;
  type: AccountType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountRepository {
  create(type: AccountType): Promise<DomainAccount>;
}
