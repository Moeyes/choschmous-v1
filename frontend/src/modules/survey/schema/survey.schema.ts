import { z } from 'zod';

const eventSchema = z.object({
    id: z.number(),
    name_kh: z.string(),
    type: z.string(),
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
    sports_id: z.number(),
    name_kh: z.string(),
    sport_type: z.string().optional(),
    created_at: z.string().optional(),
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

const surveyFormDataSchema = z.object({
    eventId: z.number().int().positive().nullable().refine(val => val !== null, { message: 'Event is required' }),
    organizationId: z.number().int().positive().nullable().refine(val => val !== null, { message: 'Organization is required' }),
    sportIds: z.array(z.number().int().positive()).min(1, 'Select at least one sport'),
});

const surveySubmissionPayloadSchema = z.object({
    organization_id: z.number(),
    event_id: z.number(),
    sport_ids: z.array(z.number()),
});

export type Event = z.infer<typeof eventSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Sport = z.infer<typeof sportSchema>;
export type SurveyFormData = z.infer<typeof surveyFormDataSchema>;
export type SurveySubmissionPayload = z.infer<typeof surveySubmissionPayloadSchema>;

export { surveyFormDataSchema as surveySchema };
