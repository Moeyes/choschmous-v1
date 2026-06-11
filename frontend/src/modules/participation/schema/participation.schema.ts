import * as z from 'zod';

export const participationSchema = z.object({
    id: z.number().int(),
    // Real FK the backend returns (participation_per_sport.sports_Events_id ->
    // sports_event_org). The table has no flat enroll/sport/event ids.
    sports_Events_id: z.number().int().nullable().optional(),
    org_id: z.number().int().nullable().optional(),
    created_at: z.string(),

    status: z.string().optional(),
    review_note: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),

    athlete_male_count: z.number().int().nullable().optional(),
    athlete_female_count: z.number().int().nullable().optional(),
    leader_male_count: z.number().int().nullable().optional(),
    leader_female_count: z.number().int().nullable().optional(),

    // Enriched names the backend joins in.
    org_name: z.string().nullable().optional(),
    event_name: z.string().nullable().optional(),

    // Legacy/aspirational fields the backend does NOT send for this table; kept
    // optional so components that reference them compile and render undefined
    // instead of the whole parse throwing.
    enroll_id: z.number().int().optional(),
    sport_id: z.number().int().optional(),
    event_id: z.number().int().optional(),
    category_id: z.number().int().nullable().optional(),
    sport_name: z.string().optional(),
    category_name: z.string().optional(),
    participant_name: z.string().optional(),
}).strict();

type ParticipationParsed = z.infer<typeof participationSchema>;

export const participationListSchema = z.object({
    data: participationSchema.array(),
    count: z.number().int().nonnegative(),
}).strict();

type ParticipationListParsed = z.infer<typeof participationListSchema>;
