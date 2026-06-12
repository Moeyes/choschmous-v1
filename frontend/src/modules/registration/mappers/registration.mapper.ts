import type { RegisterFormData } from '../schema/registration.schema';
import type { RegisterPayload, ApiErrorResponse } from '../types';

export function formDataToPayload(data: RegisterFormData, userId: string): RegisterPayload {
    return {
        userId,
        eventId: data.eventId as number,
        organizationId: Number(data.organizationId),
        sportId: data.sportId as number,
        categoryId: data.categoryId ?? null,
        teamId: data.teamId ?? null,
        force: data.force ?? false,

        lastNameKhmer: data.khFamilyName,
        firstNameKhmer: data.khGivenName,
        lastNameLatin: data.enFamilyName,
        firstNameLatin: data.enGivenName,
        phone: data.phone,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        idDocType: data.idDocumentType,
        address: data.address,
        nationality: data.nationality,

        role: data.role,
        leaderRole: data.leaderRole || null,

        photoUrl: data.photoPath ?? null,
        birthCertificateUrl: data.birthCertificatePath ?? null,
        nationalIdUrl: data.nationalIdPath ?? null,
        passportUrl: data.passportPath ?? null,
        nationalityDocumentUrl: null,
    };
}

/** Normalized view of a registration error, whatever shape the backend used:
 * a plain string, a FastAPI validation array, or a structured
 * `{code, message, params, duplicate_suspect}` from the Phase-2 rules. */
export interface ParsedError {
    code?: string;
    message: string;
    params?: Record<string, unknown>;
    duplicateSuspect?: boolean;
    fields?: Map<string, string>;
}

export function parseApiError(error: ApiErrorResponse): ParsedError {
    const detail = error?.detail;

    if (typeof detail === 'string') {
        return { message: detail };
    }

    if (Array.isArray(detail)) {
        const fields = new Map<string, string>();
        detail.forEach((err) => {
            fields.set(err.loc[err.loc.length - 1], err.msg);
        });
        return { message: detail[0]?.msg ?? 'Validation error', fields };
    }

    if (detail && typeof detail === 'object') {
        const d = detail as {
            code?: string;
            message?: string;
            params?: Record<string, unknown>;
            duplicate_suspect?: boolean;
        };
        return {
            code: d.code,
            message: d.message ?? 'An unexpected error occurred. Please try again.',
            params: d.params,
            duplicateSuspect: d.duplicate_suspect === true,
        };
    }

    return { message: 'An unexpected error occurred. Please try again.' };
}
