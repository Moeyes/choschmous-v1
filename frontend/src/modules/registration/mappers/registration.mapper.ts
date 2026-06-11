import type { RegisterFormData } from '../schema/registration.schema';
import type { RegisterPayload, ApiErrorResponse } from '../types';

export function formDataToPayload(data: RegisterFormData, userId: string): RegisterPayload {
    return {
        userId,
        eventId: data.eventId as number,
        organizationId: Number(data.organizationId),
        sportId: data.sportId as number,
        categoryId: data.categoryId ?? null,

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

export function parseApiError(error: ApiErrorResponse): string | Map<string, string> {
    const detail = error?.detail;

    if (typeof detail === 'string') {
        return detail;
    }

    if (Array.isArray(detail)) {
        const map = new Map<string, string>();
        detail.forEach((err) => {
            const field = err.loc[err.loc.length - 1];
            map.set(field, err.msg);
        });
        return map;
    }

    return 'An unexpected error occurred. Please try again.';
}
