import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Full name is required')
      .max(100, 'Full name must be 100 characters or fewer'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      // 128-char cap prevents bcrypt DoS (bcrypt silently truncates at 72 bytes;
      // 128 is the conventional safe ceiling without leaking the implementation detail)
      .max(128, 'Password must be 128 characters or fewer')
      .regex(/\p{L}/u, 'Password must contain at least one letter')
      .regex(/\p{N}/u, 'Password must contain at least one digit'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
