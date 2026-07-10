export interface User {
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
