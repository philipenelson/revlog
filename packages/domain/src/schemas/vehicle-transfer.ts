import { z } from 'zod';

export const initiateTransferSchema = z.object({
  recipientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(254, 'Email must be 254 characters or fewer'),
});

export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;
