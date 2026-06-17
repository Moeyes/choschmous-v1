import * as z from 'zod';

/**
 * Server responses are untrusted — parse at the adapter boundary.
 * `status` is kept a tolerant string (narrowed to SportSubmissionStatus in the
 * UI with a SUBMITTED fallback) so an unexpected stored value renders rather
 * than throwing the whole parse, mirroring the participation schema.
 */
export const sportSubmissionSchema = z
    .object({
        id: z.number().int(),
        events_id: z.number().int().nullable().optional(),
        sports_id: z.number().int().nullable().optional(),
        organization_id: z.number().int().nullable().optional(),
        created_at: z.string(),

        status: z.string().optional(),
        review_note: z.string().nullable().optional(),
        reviewed_at: z.string().nullable().optional(),

        org_name: z.string().nullable().optional(),
        sport_name: z.string().nullable().optional(),
        event_name: z.string().nullable().optional(),
    })
    .strict();

export const sportSubmissionListSchema = z
    .object({
        data: sportSubmissionSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();
