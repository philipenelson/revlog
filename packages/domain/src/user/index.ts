import type { DomainAccount, AccountType } from '../account';

export interface DomainUser {
  id: string;
  accountId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: string;
  emailVerified: boolean;
  // Email verification is a 6-digit OTP (ADR 0037): the code is stored hashed,
  // with a short expiry and a decrementing attempt counter. All three are set
  // together at registration/resend and cleared together on success or burn.
  verificationCodeHash: string | null;
  verificationCodeExpiresAt: Date | null;
  verificationAttemptsRemaining: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  accountId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  verificationCodeHash: string;
  verificationCodeExpiresAt: Date;
  verificationAttemptsRemaining: number;
}

// Data for the atomic account+user creation path (no accountId — the repo derives it)
export type NewUserRegistrationData = Omit<CreateUserData, 'accountId'>;

// The OTP fields written together at registration and on resend (ADR 0037).
export interface VerificationCodeData {
  codeHash: string;
  expiresAt: Date;
  attemptsRemaining: number;
}

export interface IUserRepository {
  findById(id: string): Promise<DomainUser | null>;
  findByAccountId(accountId: string): Promise<DomainUser | null>;
  findByEmail(email: string): Promise<DomainUser | null>;
  create(data: CreateUserData): Promise<DomainUser>;
  // Sets a fresh verification code + expiry + attempt count (register/resend, ADR 0037).
  setVerificationCode(id: string, data: VerificationCodeData): Promise<void>;
  // Atomically decrements the attempt counter by one (wrong-but-attempts-remain).
  decrementVerificationAttempt(id: string): Promise<void>;
  // Clears all three OTP fields (attempt-burn) so no further submit can match.
  clearVerificationCode(id: string): Promise<void>;
  // Marks the User verified and clears all three OTP fields.
  markVerified(id: string): Promise<void>;
  // Atomically creates a new Account and a linked User in a single transaction.
  // Crosses entity boundary by design — registration is inherently atomic.
  createWithAccount(accountType: AccountType, userData: NewUserRegistrationData): Promise<{ account: DomainAccount; user: DomainUser }>;
}
