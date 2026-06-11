import * as z from 'zod';
import { InstituteType } from '../types';

export const organizationPublicSchema = z
    .object({
        id:         z.number().int(),
        name_kh:    z.string().min(1).max(100),
        name_en:    z.string().nullable().optional(),
        type:       z.nativeEnum(InstituteType),
        code:       z.string().nullable().optional(),
        created_at: z.string(),
    })
    .strict();

export type OrganizationPublic = z.infer<typeof organizationPublicSchema>;

export const organizationsPublicSchema = z
    .object({
        data:  organizationPublicSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

export type OrganizationsPublic = z.infer<typeof organizationsPublicSchema>;

export const orgFormSchema = z.object({
    name_kh: z.string().min(2),
    name_en: z.string().optional().or(z.literal('')),
    type:    z.nativeEnum(InstituteType),
});

export type OrgFormValues = z.infer<typeof orgFormSchema>;

export const instituteTypeOptions = [
    { value: InstituteType.PROVINCE, labelKey: 'types.province' },
    { value: InstituteType.MINISTRY, labelKey: 'types.ministry' },
    { value: InstituteType.FEDERATION, labelKey: 'types.federation' },
    { value: InstituteType.UNIVERSITY, labelKey: 'types.university' },
] as const;
