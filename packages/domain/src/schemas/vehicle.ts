import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  // Client-generated (mobile offline creation, ADR 0027's 2026-07-03 update)
  // — omitted entirely by the web client, which lets the API default it.
  id: z.uuid().optional(),
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

export const updateVehicleSchema = createVehicleSchema.partial().refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' },
);
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
