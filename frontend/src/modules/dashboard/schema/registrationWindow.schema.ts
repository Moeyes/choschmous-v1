import { z } from 'zod';

/** System-wide registration-window headline for the dashboard status line.
 *  Mirrors the backend RegistrationWindowResponse (registration-window).
 *  Public scheduling data — no PII. */
export const registrationWindowStatusSchema = z.enum([
    'open',
    'closed',
    'scheduled',
    'unknown',
]);

export const registrationWindowSchema = z.object({
    status: registrationWindowStatusSchema,
    opensOn: z.string().nullish(),
    closesOn: z.string().nullish(),
});

export const registrationWindowResponseSchema = z.object({
    success: z.boolean(),
    data: registrationWindowSchema,
});

export type RegistrationWindowStatus = z.infer<typeof registrationWindowStatusSchema>;
export type RegistrationWindow = z.infer<typeof registrationWindowSchema>;
