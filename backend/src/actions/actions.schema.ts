import { z } from 'zod';

export const createActionSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

/**
 * An explicit set, not a toggle: sending the same value twice is idempotent, so
 * a double-tapped checkbox or a retried request cannot land in the wrong state.
 * Strict, so a misspelled field is a 400 rather than a silent no-op.
 */
export const patchActionSchema = z
  .object({
    completed: z.boolean(),
  })
  .strict();
