import * as z from 'zod';

export const registerResponseSchema = z.object({
    status:   z.string(),
    enroll_id: z.number().int(),
    // The backend register endpoint returns only { status, enroll_id }; it does
    // not echo the user_id. Optional so the strict parse of the real response
    // succeeds instead of throwing.
    user_id:  z.string().optional(),
}).strict();

type RegisterResponseParsed = z.infer<typeof registerResponseSchema>;

const enrollmentSchema = z.object({
    id: z.number().int(),
    user_id: z.string(),
    event_id: z.number().int(),
    organization_id: z.number().int(),
    sport_id: z.number().int(),
    category_id: z.number().int().nullable().optional(),
    kh_family_name: z.string(),
    kh_given_name: z.string(),
    en_family_name: z.string(),
    en_given_name: z.string(),
    phone: z.string(),
    gender: z.string(),
    date_of_birth: z.string(),
    id_document_type: z.string(),
    address: z.string().optional(),
    nationality: z.string().optional(),
    role: z.string(),
    leader_role: z.string().nullable().optional(),
    photo_url: z.string().nullable().optional(),
    birth_certificate_url: z.string().nullable().optional(),
    national_id_url: z.string().nullable().optional(),
    passport_url: z.string().nullable().optional(),
    created_at: z.string(),
    event_name: z.string().optional(),
    org_name: z.string().optional(),
    sport_name: z.string().optional(),
    category_name: z.string().optional(),
}).strict();

type EnrollmentParsed = z.infer<typeof enrollmentSchema>;

/**
 * Lean list/search item — data minimization (data-governance §2). The
 * registrations table only renders these fields, so the backend list/search
 * endpoint returns no Restricted-PII (phone, DOB, national-ID/passport URLs,
 * gender, address). `.strict()` is deliberate: if any of those ever leak back
 * into the list response, this parse fails loudly rather than silently caching
 * PII. Full records come only from the detail endpoint (enrollmentSchema).
 */
const enrollmentListItemSchema = z.object({
    id: z.number().int(),
    created_at: z.string().nullable(),
    kh_family_name: z.string(),
    kh_given_name: z.string(),
    en_family_name: z.string(),
    en_given_name: z.string(),
    photo_url: z.string().nullable().optional(),
    sport_name: z.string().nullable().optional(),
    event_name: z.string().nullable().optional(),
    role: z.string(),
    leader_role: z.string().nullable().optional(),
}).strict();

type EnrollmentListItemParsed = z.infer<typeof enrollmentListItemSchema>;

export const enrollmentListResponseSchema = z.object({
    status: z.string(),
    data:   enrollmentListItemSchema.array(),
    count:  z.number().int().nonnegative(),
    // Pagination metadata the backend's get_participants() actually returns.
    // Listed so .strict() accepts the real envelope instead of throwing.
    total_pages: z.number().int().optional(),
    has_next:    z.boolean().optional(),
    has_prev:    z.boolean().optional(),
    page:        z.number().int().optional(),
    page_size:   z.number().int().optional(),
}).strict();

type EnrollmentListParsed = z.infer<typeof enrollmentListResponseSchema>;

/** Response of the audited PII reveal endpoint. */
export const revealedPiiSchema = z.object({
    enroll_id: z.number().int(),
    phone: z.string(),
}).strict();

type RevealedPiiParsed = z.infer<typeof revealedPiiSchema>;

/* ------------------------------------------------------------------ *
 * Single-participant DETAIL view (GET /api/registration/{id}?role=).
 *
 * This mirrors the backend's `_format_row` projection exactly, which differs
 * from the flat `enrollmentSchema` above: it nests sport/organization/category
 * as { id, name } objects and returns Khmer/Latin composed names. Athlete rows
 * carry `category`; leader rows carry `leader_role` — so both are optional.
 *
 * Deliberately NOT `.strict()`: the detail endpoint is the one view allowed to
 * return Restricted-PII, and athlete/leader rows have slightly different keys.
 * Unknown keys are stripped rather than thrown, so a backend field addition
 * can't crash the page (the register/list strict-parse crash we just fixed).
 * ------------------------------------------------------------------ */
const namedRefSchema = z.object({
    id: z.number().int(),
    name: z.string().nullable().optional(),
}).nullable().optional();

const participantDetailSchema = z.object({
    participant_id: z.number().int(),
    id: z.number().int(),
    created_at: z.string().nullable().optional(),
    role: z.string(),

    kh_family_name: z.string(),
    kh_given_name: z.string(),
    en_family_name: z.string(),
    en_given_name: z.string(),
    name_kh: z.string().nullable().optional(),
    name_en: z.string().nullable().optional(),

    gender: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),

    photo_url: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    nationalityDocumentUrl: z.string().nullable().optional(),
    birthCertificateUrl: z.string().nullable().optional(),
    nationalIdUrl: z.string().nullable().optional(),
    passportUrl: z.string().nullable().optional(),

    event_id: z.number().int().nullable().optional(),
    event_name: z.string().nullable().optional(),
    sport_name: z.string().nullable().optional(),
    sport: namedRefSchema,
    organization: namedRefSchema,

    // Athlete-only
    category: namedRefSchema,
    // Leader-only
    leader_role: z.string().nullable().optional(),
});

export type ParticipantDetailParsed = z.infer<typeof participantDetailSchema>;

/**
 * The detail endpoint wraps the record in a { status, data } envelope (same
 * shape family as the list endpoint). Parse the envelope, then callers read
 * `.data`.
 */
export const participantDetailResponseSchema = z.object({
    status: z.string(),
    data: participantDetailSchema,
});

/* ------------------------------------------------------------------ *
 * Registration form (RHF input) validation schema.
 * Client-side UX validation only — the adapter still parses every
 * server response and the backend re-validates all input.
 * ------------------------------------------------------------------ */

// Phone regex: 7-15 digits
const phoneRegex = /^\d{7,15}$/;

// Date must be in the past (user's birth date)
const pastDateSchema = z.string().refine(
    (date) => {
        const d = new Date(date);
        return !isNaN(d.getTime()) && d <= new Date();
    },
    'Birth date must be today or earlier'
);

export const registerSchema = z.object({
    // Context selection - all required
    eventType: z.string().min(1, 'Event Type is required').nullable(),
    eventId: z.number().min(1, 'Event is required').nullable(),
    organizationId: z.string().min(1, 'Organization is required').nullable(),
    sportId: z.number().min(1, 'Sport is required').nullable(),
    categoryId: z.number().min(1, 'Category is required').nullable(),

    // Personal information
    khFamilyName: z.string().trim().min(1, 'Khmer family name is required'),
    khGivenName: z.string().trim().min(1, 'Khmer given name is required'),
    enFamilyName: z.string().trim().min(1, 'English family name is required'),
    enGivenName: z.string().trim().min(1, 'English given name is required'),
    gender: z.string()
        .toUpperCase()
        .pipe(z.enum(['MALE', 'FEMALE', 'OTHER'], { error: 'Please select a gender' })),
    dateOfBirth: pastDateSchema,
    nationality: z
        .string()
        .trim()
        .min(1, 'Nationality is required')
        .default('Cambodian'),
    phone: z
        .string()
        .trim()
        .regex(phoneRegex, 'Phone must be 7-15 digits'),
    idDocumentType: z.string()
        .toUpperCase()
        .pipe(z.enum(['IDCARD', 'BIRTHCERTIFICATE', 'PASSPORT', 'FAMILYBOOK', 'OTHER'])),
    address: z.string().trim().optional(),

    // Role information
    role: z.string()
        .toLowerCase()
        .pipe(z.enum(['athlete', 'leader'])),
    leaderRole: z.string()
        .optional()
        .refine((val) => !val || val.length > 0, 'Leader role cannot be empty'),

    // Document paths — uploads return a relative path (/api/files/{id}), so
    // these are plain non-empty strings, not absolute URLs.
    photoPath: z.string().min(1, 'Profile photo is required').nullable(),
    birthCertificatePath: z.string().optional().nullable(),
    nationalIdPath: z.string().optional().nullable(),
    passportPath: z.string().optional().nullable(),

    // Document upload toggles (UI-only, not sent to backend)
    _uploadPhoto: z.boolean().optional(),
    _uploadId: z.boolean().optional(),
    _uploadBirth: z.boolean().optional(),
    _uploadPassport: z.boolean().optional(),
}).refine(
    (data) => data.eventType !== null && data.eventType !== undefined && data.eventType !== '',
    {
        message: 'Event Type is required',
        path: ['eventType'],
    }
).refine(
    (data) => data.eventId !== null && data.eventId !== undefined,
    {
        message: 'Event is required',
        path: ['eventId'],
    }
).refine(
    (data) => data.organizationId !== null && data.organizationId !== undefined,
    {
        message: 'Organization is required',
        path: ['organizationId'],
    }
).refine(
    (data) => data.sportId !== null && data.sportId !== undefined,
    {
        message: 'Sport is required',
        path: ['sportId'],
    }
).refine(
    (data) => {
        if (data.role === 'athlete' && !data.categoryId) {
            return false;
        }
        return true;
    },
    {
        message: 'Athletes must select a category',
        path: ['categoryId'],
    }
).refine(
    (data) => {
        if (data.role === 'leader' && !data.leaderRole) {
            return false;
        }
        return true;
    },
    {
        message: 'Leaders must have a role assigned',
        path: ['leaderRole'],
    }
);

export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterFormData = z.output<typeof registerSchema>;
