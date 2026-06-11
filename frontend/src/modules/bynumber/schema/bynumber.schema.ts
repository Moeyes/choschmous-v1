import { z } from 'zod';

const eventSchema = z.object({
    id: z.number(),
    name_kh: z.string(),
    type: z.string().optional(),
    created_at: z.string().optional(),
});

const organizationSchema = z.object({
    id: z.number(),
    name_kh: z.string(),
    // The backend (OrganizationPublic) sends `code` as null for orgs without one,
    // so accept null — `.optional()` alone rejects it and nukes the whole list.
    type: z.string().nullish(),
    code: z.string().nullish(),
    created_at: z.string().nullish(),
});

export const sportSchema = z.object({
    id: z.number(),
    name_kh: z.string(),
    sport_type: z.string().optional(),
    created_at: z.string().optional(),
});

const sportRowSchema = z.object({
    sport_id: z.number(),
    sport_name_kh: z.string(),
    athlete_male_count: z.number(),
    athlete_female_count: z.number(),
    leader_male_count: z.number(),
    leader_female_count: z.number(),
    sportsEventOrgId: z.number().optional(),
    maleCount: z.number().optional(),
    femaleCount: z.number().optional(),
});

const sportEntrySchema = z.object({
    id: z.number(),
    name_kh: z.string(),
});

export const eventListResponseSchema = z.object({
    data: z.array(eventSchema),
});

export const sportListResponseSchema = z.object({
    data: z.array(sportEntrySchema),
});

export const organizationListResponseSchema = z.object({
    data: z.array(organizationSchema),
});

export const sportsEventResponseSchema = z.object({
    id: z.number(),
    event_name: z.string().optional(),
    sport_name: z.string().optional(),
    created_at: z.string().optional(),
});

export const sportEventOrgResponseSchema = z.object({
    id: z.number(),
    organization_id: z.number(),
    organization_name: z.string(),
    created_at: z.string(),
});

const sportCountSchema = z.object({
    sport_id: z.number().int().positive(),
    sport_name_kh: z.string().min(1),
    athlete_male_count: z.number().int().min(0),
    athlete_female_count: z.number().int().min(0),
    leader_male_count: z.number().int().min(0),
    leader_female_count: z.number().int().min(0),
    sportsEventOrgId: z.number().int().optional(),
    maleCount: z.number().int().optional(),
    femaleCount: z.number().int().optional(),
});

export const byNumberSchema = z.object({
    eventId: z.number().int().positive('Event is required').nullable(),
    organizationId: z.number().int().positive('Organization is required').nullable(),
    sports: z.array(sportCountSchema)
        .min(1, 'Select at least one sport')
        .refine(
            (sports) => sports.some((sport) => {
                const total = sport.athlete_male_count + sport.athlete_female_count +
                    sport.leader_male_count + sport.leader_female_count;
                return total > 0;
            }),
            { message: 'At least one sport must have participant counts' }
        ),
    eventName: z.string().optional(),
    organizationName: z.string().optional(),
    sportSelections: z.array(z.number()).optional(),
});

const byNumberSubmissionPayloadSchema = z.object({
    organization_id: z.number(),
    event_id: z.number(),
    sports: z.array(z.object({
        sport_id: z.number(),
        athlete_male_count: z.number(),
        athlete_female_count: z.number(),
        leader_male_count: z.number(),
        leader_female_count: z.number(),
    })),
});

export type Event = z.infer<typeof eventSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Sport = z.infer<typeof sportSchema>;
export type SportRow = z.infer<typeof sportRowSchema>;
export type ByNumberFormInput = z.input<typeof byNumberSchema>;
export type ByNumberFormData = z.output<typeof byNumberSchema>;
export type ByNumberSubmissionPayload = z.infer<typeof byNumberSubmissionPayloadSchema>;
