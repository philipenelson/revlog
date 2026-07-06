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
  // Password reset OTP (ADR 0038): same shape as the verification triplet, but
  // independent — a reset code and a verification code can be live at once.
  passwordResetCodeHash: string | null;
  passwordResetCodeExpiresAt: Date | null;
  passwordResetAttemptsRemaining: number | null;
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

// The password-reset OTP fields, written together on forgot-password / re-request
// (ADR 0038). Same shape as VerificationCodeData but a distinct type — the two
// codes are independent and must not be interchanged at call sites.
export interface PasswordResetCodeData {
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
  // Sets a fresh password-reset code + expiry + attempt count (forgot-password, ADR 0038).
  setPasswordResetCode(id: string, data: PasswordResetCodeData): Promise<void>;
  // Atomically decrements the reset attempt counter by one (wrong-but-attempts-remain).
  decrementPasswordResetAttempt(id: string): Promise<void>;
  // Clears all three password-reset fields (attempt-burn) so no further submit can match.
  clearPasswordResetCode(id: string): Promise<void>;
  // Sets a new passwordHash, marks the User verified (a valid emailed OTP proves
  // inbox control — ADR 0038 §6), and clears all three reset fields, atomically.
  resetPassword(id: string, passwordHash: string): Promise<void>;
  // Atomically creates a new Account and a linked User in a single transaction.
  // Crosses entity boundary by design — registration is inherently atomic.
  createWithAccount(accountType: AccountType, userData: NewUserRegistrationData): Promise<{ account: DomainAccount; user: DomainUser }>;
}
