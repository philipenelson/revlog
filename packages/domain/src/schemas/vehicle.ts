import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  nickname: z
    .string()
    .trim()
    .max(100, 'Nickname must be 100 characters or fewer')
    .optional()
    .transform((value) => (value ? value : null)),
  make: z
    .string()
    .trim()
    .min(1, 'Enter the manufacturer.')
    .max(100, 'Make must be 100 characters or fewer'),
  model: z
    .string()
    .trim()
    .min(1, 'Enter the model.')
    .max(100, 'Model must be 100 characters or fewer'),
  year: z.coerce
    .number()
    .int('Enter a numeric year.')
    .min(1900, 'Year must be 1900 or later')
    .max(currentYear + 1, `Year must be ${currentYear + 1} or earlier`),
  mileage: z.coerce
    .number()
    .int('Enter the current mileage.')
    .min(0, 'Mileage cannot be negative')
    .max(2_000_000, 'Mileage must be 2,000,000 or fewer'),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
