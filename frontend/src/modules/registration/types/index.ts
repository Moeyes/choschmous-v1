/**
 * Registration Types
 *
 * Payload field names must match the backend FullRegistrationRequest aliases exactly.
 *
 * Backend aliases (what we must send):
 *   kh_family_name  ← alias: lastNameKhmer
 *   kh_given_name   ← alias: firstNameKhmer
 *   en_family_name  ← alias: lastNameLatin
 *   en_given_name   ← alias: firstNameLatin
 *   date_of_birth   ← alias: dateOfBirth
 *   id_document_type← alias: idDocType
 *   phone           ← alias: phone (same)
 */

// ─── API Payload ─────────────────────────────────────────────────────────────
// Must match backend FullRegistrationRequest exactly

export interface RegisterPayload {
    // Authenticated user registering this participant
    userId: string;

    // Event context
    eventId: number;
    organizationId: number;
    sportId: number;
    categoryId?: number | null;

    // Personal info — using backend aliases
    lastNameKhmer: string;
    firstNameKhmer: string;
    lastNameLatin: string;
    firstNameLatin: string;
    phone: string;
    gender: string;
    dateOfBirth: string;        
    idDocType: string;          
    address?: string;
    nationality?: string;

    // Role
    role: string;
    leaderRole?: string | null;

    // Document URLs
    photoUrl?: string | null;
    birthCertificateUrl?: string | null;
    nationalIdUrl?: string | null;
    passportUrl?: string | null;
    nationalityDocumentUrl?: string | null;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface RegisterResponse {
    status: string;
    enroll_id: number;
    // Not returned by the backend register endpoint — present only if echoed.
    user_id?: string;
}

export interface EnrollmentListResponse {
    data: Array<{
        id: number;
        created_at: string | null;
        kh_family_name: string;
        kh_given_name: string;
        en_family_name: string;
        en_given_name: string;
        photo_url?: string | null;
        sport_name?: string | null;
        event_name?: string | null;
        role: string;
        leader_role?: string | null;
    }>;
    count: number;
}

/**
 * Full single-participant record from the detail endpoint. Shape is defined by
 * (and inferred from) `participantDetailSchema`, which mirrors the backend's
 * `_format_row` projection — see that schema for the nested sport/org/category
 * objects and the athlete-vs-leader differences.
 */
export type { ParticipantDetailParsed as ParticipantDetailRecord } from '../schema/registration.schema';

/**
 * Partial-update payload for the detail edit form. Field names match the
 * backend `ParticipantUpdateRequest` exactly (the PATCH /registration/update
 * `data` object). Every field is optional — only what's sent gets changed.
 */
export interface ParticipantUpdateData {
    kh_family_name?: string;
    kh_given_name?: string;
    en_family_name?: string;
    en_given_name?: string;
    phone?: string;
    gender?: string;
    date_of_birth?: string;
    address?: string;
    photoUrl?: string | null;
    nationalityDocumentUrl?: string | null;
    birthCertificateUrl?: string | null;
    nationalIdUrl?: string | null;
    passportUrl?: string | null;
    sport_id?: number;
    organization_id?: number;
    category_id?: number;
    leader_role?: string;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
    detail?: string | FieldError[];
}

interface FieldError {
    loc: string[];
    msg: string;
    type: string;
}

// ─── Payload Transformer ──────────────────────────────────────────────────────

export { formDataToPayload, parseApiError } from '../mappers/registration.mapper';