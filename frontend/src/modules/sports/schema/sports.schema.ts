import * as z from 'zod';
import { Gender } from '../types';

const genderSchema = z.preprocess(
    (val) => typeof val === 'string' ? val.toLowerCase() : val,
    z.nativeEnum(Gender).nullable().optional(),
);

export const sportPublicSchema = z
    .object({
        id:             z.number().int(),
        name_kh:        z.string().min(1).max(100),
        name_en:        z.string().optional(),
        description:    z.string().optional(),
        sport_type:     z.string().optional(),
        created_at:     z.string().optional(),
        updated_at:     z.string().optional(),
        category_count: z.number().int().optional(),
    })
    .strict();

export type SportPublic = z.infer<typeof sportPublicSchema>;

export const sportsPublicSchema = z
    .object({
        data:  sportPublicSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

export type SportsPublic = z.infer<typeof sportsPublicSchema>;

export const categoryPublicSchema = z
    .object({
        id:             z.number().int(),
        category:       z.string().min(1),
        gender:         genderSchema,
        team_size_min:  z.number().int().nullable().optional(),
        team_size_max:  z.number().int().nullable().optional(),
        created_at:     z.string().optional(),
        sport_name:     z.string().nullable().optional(),
    })

export type CategoryPublic = z.infer<typeof categoryPublicSchema>;

export const categoriesPublicSchema = categoryPublicSchema.array();

export type CategoriesPublic = z.infer<typeof categoriesPublicSchema>;

const sportParticipantSchema = z
    .object({
        participant_id: z.number().int(),
        name_kh:        z.string(),
        name_en:        z.string(),
        gender:         z.string(),
        phone:          z.string().nullable().optional(),
        date_of_birth:  z.string().nullable().optional(),
        photoUrl:       z.string().nullable().optional(),
        role:           z.union([z.literal('athlete'), z.literal('leader')]),
        // name is nullable: the backend builds these from outer joins, so the
        // label can be absent even when the id resolves.
        sport:          z.object({ id: z.number().int(), name: z.string().nullable().optional() }).nullable().optional(),
        organization:   z.object({ id: z.number().int(), name: z.string().nullable().optional() }).nullable().optional(),
        event_id:       z.number().int().nullable().optional(),
        category:       z.object({ id: z.number().int(), name: z.string().nullable().optional() }).nullable().optional(),
        leader_role:    z.string().nullable().optional(),
    })
    .strict();

export const sportParticipantsPublicSchema = z
    .object({
        status: z.string(),
        data:   sportParticipantSchema.array(),
        count:  z.number().int().nonnegative(),
        // Pagination metadata get_participants() returns; listed so the strict
        // parse accepts the real envelope instead of throwing.
        total_pages: z.number().int().optional(),
        has_next:    z.boolean().optional(),
        has_prev:    z.boolean().optional(),
        page:        z.number().int().optional(),
        page_size:   z.number().int().optional(),
    })
    .strict();

export type SportParticipantsPublic = z.infer<typeof sportParticipantsPublicSchema>;

export const sportFormSchema = z.object({
    name_kh:    z.string().min(2),
    sport_type: z.string().optional().or(z.literal('')),
});

export type SportFormValues = z.infer<typeof sportFormSchema>;

// Number inputs hand back strings; coerce blank/null to null, otherwise to an int.
const teamSizeField = z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().int().min(1).nullable(),
);

export const categoryFormSchema = z.object({
    category:      z.string().min(2),
    gender:        genderSchema,
    // 'team' reveals the size inputs; 'individual' clears them on save.
    categoryType:  z.enum(['individual', 'team']),
    team_size_min: teamSizeField.optional(),
    team_size_max: teamSizeField.optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
