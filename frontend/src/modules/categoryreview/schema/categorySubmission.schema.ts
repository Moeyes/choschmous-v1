import * as z from 'zod';

/**
 * Server responses are untrusted — parse at the adapter boundary.
 * `status`/`gender` stay tolerant strings (narrowed in the UI) so an unexpected
 * stored value renders rather than failing the whole parse.
 */
const categoryEntrySchema = z
    .object({
        id: z.number().int(),
        category: z.string(),
        gender: z.string().nullable().optional(),
        sports_id: z.number().int().nullable().optional(),
        events_id: z.number().int().nullable().optional(),
        created_at: z.string(),
    })
    .strict();

const categorySubmissionShape = {
    id: z.number().int(),
    events_id: z.number().int().nullable().optional(),
    sports_id: z.number().int().nullable().optional(),
    event_name: z.string().nullable().optional(),
    sport_name: z.string().nullable().optional(),
    category_count: z.number().int().nonnegative(),
    created_at: z.string(),

    status: z.string().optional(),
    review_note: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
};

export const categorySubmissionSchema = z.object(categorySubmissionShape).strict();

export const categorySubmissionDetailSchema = z
    .object({ ...categorySubmissionShape, categories: categoryEntrySchema.array() })
    .strict();

export const categorySubmissionListSchema = z
    .object({
        data: categorySubmissionSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

export const categoryBulkReviewResultSchema = z
    .object({
        updated: z.number().int().nonnegative(),
        status: z.string(),
    })
    .strict();
