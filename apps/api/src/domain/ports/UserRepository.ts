import type { AccountType } from '@maintenance-log/contracts';
import type {
  User,
  CreateUserData,
  NewUserRegistrationData,
  VerificationCodeData,
  PasswordResetCodeData,
} from '../models/User';
import type { Account } from '../models/Account';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByAccountId(accountId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
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
  createWithAccount(accountType: AccountType, userData: NewUserRegistrationData): Promise<{ account: Account; user: User }>;
}
