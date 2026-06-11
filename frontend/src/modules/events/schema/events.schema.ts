import * as z from 'zod';
import { EventType, AgeMode, PhaseStatus } from '../types';

export const rawEventSchema = z
    .object({
        id:              z.number().int(),
        name_kh:         z.string().optional(),
        description:     z.string().nullable().optional(),
        start_date:      z.string().optional(),
        end_date:        z.string().optional(),
        type:            z.string().optional(),
        event_type:      z.string().optional(),
        location:        z.string().nullable().optional(),
        age_mode:        z.string().nullable().optional(),
        age_min:         z.number().int().nullable().optional(),
        age_max:         z.number().int().nullable().optional(),

        survey_category_status: z.string().optional(),
        survey_category_open_date: z.string().nullable().optional(),
        survey_category_close_date: z.string().nullable().optional(),
        survey_sport_status: z.string().optional(),
        survey_sport_open_date: z.string().nullable().optional(),
        survey_sport_close_date: z.string().nullable().optional(),
        survey_number_status: z.string().optional(),
        survey_number_open_date: z.string().nullable().optional(),
        survey_number_close_date: z.string().nullable().optional(),
        registration_status: z.string().optional(),
        registration_open_date: z.string().nullable().optional(),
        registration_close_date: z.string().nullable().optional(),

        survey_category_is_open: z.boolean().optional(),
        survey_sport_is_open: z.boolean().optional(),
        survey_number_is_open: z.boolean().optional(),
        registration_is_open: z.boolean().optional(),

        created_at: z.string().optional(),
        updated_at: z.string().optional(),
    })
    .strict();

export type RawEvent = z.infer<typeof rawEventSchema>;

export const rawEventsSchema = z
    .object({
        data:  rawEventSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

type RawEvents = z.infer<typeof rawEventsSchema>;

export const eventPublicSchema = z.object({
    id:         z.number().int(),
    name:       z.string(),
    description: z.string().optional(),
    start_date: z.string(),
    end_date:   z.string(),
    event_type: z.nativeEnum(EventType),
    location:   z.string().optional(),
    age_mode:   z.nativeEnum(AgeMode).nullable().optional(),
    age_min:    z.number().int().nullable().optional(),
    age_max:    z.number().int().nullable().optional(),

    survey_category_status: z.nativeEnum(PhaseStatus).optional(),
    survey_category_open_date: z.string().nullable().optional(),
    survey_category_close_date: z.string().nullable().optional(),
    survey_sport_status: z.nativeEnum(PhaseStatus).optional(),
    survey_sport_open_date: z.string().nullable().optional(),
    survey_sport_close_date: z.string().nullable().optional(),
    survey_number_status: z.nativeEnum(PhaseStatus).optional(),
    survey_number_open_date: z.string().nullable().optional(),
    survey_number_close_date: z.string().nullable().optional(),
    registration_status: z.nativeEnum(PhaseStatus).optional(),
    registration_open_date: z.string().nullable().optional(),
    registration_close_date: z.string().nullable().optional(),

    survey_category_is_open: z.boolean().optional(),
    survey_sport_is_open: z.boolean().optional(),
    survey_number_is_open: z.boolean().optional(),
    registration_is_open: z.boolean().optional(),

    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export type EventPublic = z.infer<typeof eventPublicSchema>;

const rawEventSportSchema = z.object({
    id:         z.number().int(),
    sports_id:  z.number().int().optional(),
    event_name: z.string().optional(),
    sport_name: z.string().optional(),
    created_at: z.string().optional(),
}).strict();

export type RawEventSport = z.infer<typeof rawEventSportSchema>;

export const eventSportPublicSchema = z.object({
    id:        z.number().int(),
    sports_id: z.number().int(),
    name_kh:   z.string(),
    name_en:   z.string(),
});

export type EventSportPublic = z.infer<typeof eventSportPublicSchema>;

const rawSportOrgSchema = z.object({
    id:                z.number().int(),
    organization_id:   z.number().int(),
    organization_name: z.string(),
}).strict();

export type RawSportOrg = z.infer<typeof rawSportOrgSchema>;

export const eventSportOrgPublicSchema = z.object({
    id:      z.number().int(),
    name_kh: z.string(),
    name_en: z.string(),
    code:    z.string().optional(),
    type:    z.string().optional(),
    _linkId: z.number().int().optional(),
});

export type EventSportOrgPublic = z.infer<typeof eventSportOrgPublicSchema>;

export const eventOrganizationPublicSchema = z.object({
    id:      z.number().int(),
    name_kh: z.string(),
    name_en: z.string(),
    code:    z.string().optional(),
    type:    z.string().optional(),
});

export type EventOrganizationPublic = z.infer<typeof eventOrganizationPublicSchema>;

export const eventCategoryPublicSchema = z.object({
    id:         z.number().int(),
    category:   z.string(),
    sport_name: z.string().optional(),
    gender:     z.string().optional(),
});

export type EventCategoryPublic = z.infer<typeof eventCategoryPublicSchema>;

const eventFormSchema = z
    .object({
        name:             z.string().min(3),
        description:      z.string().optional().or(z.literal('')),
        start_date:       z.string().min(1),
        end_date:         z.string().min(1),
        event_type:       z.nativeEnum(EventType),
        location:         z.string().min(2),
        age_mode:         z.nativeEnum(AgeMode),
        age_min:          z.string().min(1),
        age_max:          z.string().min(1),

        survey_category_status: z.nativeEnum(PhaseStatus),
        survey_category_open_date: z.string().optional().or(z.literal('')),
        survey_category_close_date: z.string().optional().or(z.literal('')),
        survey_sport_status: z.nativeEnum(PhaseStatus),
        survey_sport_open_date: z.string().optional().or(z.literal('')),
        survey_sport_close_date: z.string().optional().or(z.literal('')),
        survey_number_status: z.nativeEnum(PhaseStatus),
        survey_number_open_date: z.string().optional().or(z.literal('')),
        survey_number_close_date: z.string().optional().or(z.literal('')),
        registration_status: z.nativeEnum(PhaseStatus),
        registration_open_date: z.string().optional().or(z.literal('')),
        registration_close_date: z.string().optional().or(z.literal('')),
    })
    .superRefine((data, ctx) => {
        if (data.start_date && data.end_date && data.end_date < data.start_date)
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End date must be on or after start date', path: ['end_date'] });

        const min = Number(data.age_min);
        const max = Number(data.age_max);
        if (data.age_min && data.age_max && Number.isFinite(min) && Number.isFinite(max) && min > max)
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Minimum must be less than or equal to maximum', path: ['age_max'] });

        const EVENT_PHASES = ['survey_category', 'survey_sport', 'survey_number', 'registration'] as const;
        for (const phase of EVENT_PHASES) {
            const open = data[`${phase}_open_date`];
            const close = data[`${phase}_close_date`];
            if (open && close && close < open)
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Close date must be on or after open date', path: [`${phase}_close_date`] });
        }
    });

type EventFormValues = z.infer<typeof eventFormSchema>;
