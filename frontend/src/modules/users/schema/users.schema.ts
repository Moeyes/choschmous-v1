/**
 * users.schema.ts
 *
 * Single source of truth for runtime shape validation in the users module.
 * Every adapter response is parsed through these schemas before leaving the
 * data layer. All object schemas use .strict() so unexpected keys from a
 * compromised or changed backend surface as errors rather than silent leaks.
 *
 * Also used by UserForm (via zodResolver) for client-side UX validation.
 * The form schema mirrors the backend UserCreate/UserUpdate validators —
 * role-dependent bindings are enforced here so they are testable in isolation.
 */

import * as z from 'zod';
import { UserRole } from '@/core/auth';

// ─── Shared primitives ────────────────────────────────────────────────────────

const nameField  = z.string().min(1).max(100);
const uuidField  = z.string().uuid();
const userRoleSchema = z.nativeEnum(UserRole);

// ─── API response schemas (adapter boundary) ─────────────────────────────────

/**
 * Matches backend UserPublic exactly.
 * .strict() rejects any extra keys so a backend change is a loud error,
 * not a silent data leak into the UI.
 *
 * PII fields: email, kh_family_name, kh_given_name, en_family_name, en_given_name
 * These are Restricted-PII — never place in logs, URLs, or analytics.
 */
export const userPublicSchema = z
    .object({
        id:              uuidField,
        kh_family_name:  nameField,
        kh_given_name:   nameField,
        en_family_name:  nameField,
        en_given_name:   nameField,
        email:           z.string().email().max(120),
        username:        z.string().min(1).max(50),
        role:            userRoleSchema,
        organization_id: z.number().int().nullable().optional(),
        sport_id:        z.number().int().nullable().optional(),
        photo_path:      z.string().max(255).nullable().optional(),
        full_name:       z.string().max(255).nullable().optional(),
        is_active:       z.boolean(),
        is_superuser:    z.boolean(),
        created_at:      z.string(),
    })
    .strict();

export type UserPublic = z.infer<typeof userPublicSchema>;

/** Matches backend UsersPublic (list envelope). */
export const usersPublicSchema = z
    .object({
        data:  userPublicSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

export type UsersPublic = z.infer<typeof usersPublicSchema>;

// ─── Form / mutation input schemas ───────────────────────────────────────────

export const userFormSchema = z
    .object({
        username:        z.string().min(3).max(50),
        email:           z.string().email().max(120),
        password:        z.string().max(128).optional().or(z.literal('')),
        kh_family_name:  nameField,
        kh_given_name:   nameField,
        en_family_name:  nameField,
        en_given_name:   nameField,
        role:            userRoleSchema,
        organization_id: z.union([z.number().int(), z.string(), z.null()]).optional(),
        sport_id:        z.union([z.number().int(), z.string(), z.null()]).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.role === UserRole.FEDERATION && !data.sport_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sport_id'],        message: 'errors.sportRequired' });
        }
        if (data.role === UserRole.ORGANIZATION && !data.organization_id) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['organization_id'], message: 'errors.organizationRequired' });
        }
    });

export type UserFormValues = z.infer<typeof userFormSchema>;
