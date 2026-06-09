import { z } from 'zod';

const logItemSchema = z.object({
  categoryId: z.string().min(1),
  description: z.string().min(1).max(500).trim(),
  quantity: z.number().positive().optional().nullable(),
  unitCost: z.number().min(0).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

const logMediaSchema = z.object({
  path: z.string().min(1),
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  caption: z
    .string()
    .max(300)
    .trim()
    .transform((v) => v || null)
    .optional()
    .nullable()
    .default(null),
  sortOrder: z.number().int().optional().default(0),
});

export const createLogEntrySchema = z.object({
  typeId: z.string().min(1),
  title: z.string().min(1).max(100).trim(),
  date: z.string().date(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  mileage: z.number().int().min(0).optional().nullable(),
  notes: z
    .string()
    .max(5000)
    .trim()
    .transform((v) => v || null)
    .optional()
    .nullable()
    .default(null),
  items: z.array(logItemSchema).optional().default([]),
  media: z.array(logMediaSchema).optional().default([]),
});

export const updateLogEntrySchema = createLogEntrySchema.partial();

export type CreateLogEntryInput = z.infer<typeof createLogEntrySchema>;
export type UpdateLogEntryInput = z.infer<typeof updateLogEntrySchema>;
