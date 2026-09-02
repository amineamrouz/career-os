import { z } from 'zod';

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'must be a valid ISO-8601 date',
  });

/**
 * Body schema for both POST and PUT: PUT is a full replace, so title is
 * required in both cases. Unknown keys are stripped rather than rejected, so a
 * client can PUT back a goal it just fetched (id/createdAt/actions and friends)
 * without a 400.
 */
export const goalBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  targetDate: isoDate.nullish(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export type GoalBody = z.infer<typeof goalBodySchema>;
