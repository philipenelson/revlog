import { z } from 'zod';

export const reportEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email must be 254 characters or fewer')
    .email('Enter a valid email address'),
});

export type ReportEmailInput = z.infer<typeof reportEmailSchema>;
