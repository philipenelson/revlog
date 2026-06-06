import type { DomainAccount, AccountType } from '../account';

export interface DomainUser {
  id: string;
  accountId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: string;
  emailVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  accountId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  verificationToken: string;
  verificationTokenExpiresAt: Date;
}

// Data for the atomic account+user creation path (no accountId — the repo derives it)
export type NewUserRegistrationData = Omit<CreateUserData, 'accountId'>;

export interface IUserRepository {
  findByEmail(email: string): Promise<DomainUser | null>;
  findByVerificationToken(token: string, now: Date): Promise<DomainUser | null>;
  create(data: CreateUserData): Promise<DomainUser>;
  markVerified(id: string): Promise<void>;
  // Atomically creates a new Account and a linked User in a single transaction.
  // Crosses entity boundary by design — registration is inherently atomic.
  createWithAccount(accountType: AccountType, userData: NewUserRegistrationData): Promise<{ account: DomainAccount; user: DomainUser }>;
}
