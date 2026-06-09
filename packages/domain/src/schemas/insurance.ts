import { z } from 'zod';

export const upsertInsuranceSchema = z.object({
  company:       z.string().max(200).trim().transform(v => v || null).optional().nullable().default(null),
  policyNumber:  z.string().max(100).trim().transform(v => v || null).optional().nullable().default(null),
  startDate:     z.string().date().optional().nullable().default(null),
  expiryDate:    z.string().date().optional().nullable().default(null),
  premium:       z.number().min(0).optional().nullable().default(null),
  premiumPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL']).optional().nullable().default(null),
  towNumber:     z.string().max(50).trim().transform(v => v || null).optional().nullable().default(null),
  notes:         z.string().max(2000).trim().transform(v => v || null).optional().nullable().default(null),
});

export type UpsertInsuranceInput = z.infer<typeof upsertInsuranceSchema>;
