import { z } from 'zod';

/** Submissions awaiting admin review (nav badge). Mirrors the backend
 *  ReviewPendingCountResponse (CHOS-506 review-count). */
export const reviewPendingCountSchema = z.object({
    pending: z.number(),
    byNumber: z.number(),
    byCategory: z.number(),
});

export const reviewPendingCountResponseSchema = z.object({
    success: z.boolean(),
    data: reviewPendingCountSchema,
});

export type ReviewPendingCount = z.infer<typeof reviewPendingCountSchema>;
