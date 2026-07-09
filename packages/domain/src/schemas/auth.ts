import { z } from 'zod';

// The single source of truth for password strength. Registration and password
// reset both reference this so the two can never drift — a reset must never set
// a password registration would have rejected (ADR 0038 §9). Passwords are never
// trimmed: spaces are valid password characters (root CLAUDE.md — Input handling).
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // 128-char cap prevents bcrypt DoS (bcrypt silently truncates at 72 bytes;
  // 128 is the conventional safe ceiling without leaking the implementation detail)
  .max(128, 'Password must be 128 characters or fewer')
  .regex(/\p{L}/u, 'Password must contain at least one letter')
  .regex(/\p{N}/u, 'Password must contain at least one digit');

// A trimmed, lowercased email — the shared shape used across every auth schema.
const emailField = z.string().trim().toLowerCase().email('Enter a valid email address');

// A 6-digit numeric OTP, trimmed. Shared by verify-email and password reset.
const otpCodeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email');

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Full name must be 100 characters or fewer'),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Email verification via 6-digit OTP (ADR 0037). Lookup is by email — the code
// alone is not globally unique. `code` is trimmed and must be exactly 6 digits.
export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// Password reset via 6-digit OTP (ADR 0038). Requesting a code is the same as
// resending — re-hitting the endpoint replaces the prior code.
export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset with { email, code, newPassword, confirmPassword }. `newPassword` reuses
// the shared `passwordField` — a reset can never set a password registration
// would have rejected. Lookup is by email (the code is not globally unique).
export const resetPasswordSchema = z
  .object({
    email: emailField,
    code: otpCodeField,
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
