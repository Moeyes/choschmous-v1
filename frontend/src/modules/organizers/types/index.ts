export interface OrganizerRole {
    id: number;
    name_kh: string;
    name_en: string;
    active: boolean;
}

export interface OrganizerRegistrationPayload {
    eventId: number;
    organizationId?: number | null;
    organizerRoleId: number;
    lastNameKhmer: string;
    firstNameKhmer: string;
    lastNameLatin: string;
    firstNameLatin: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    idDocType: string;
    nationality: string;
    address?: string | null;
    photoUrl?: string | null;
    nationalityDocumentPath?: string | null;
    birthCertificatePath?: string | null;
    nationalIdPath?: string | null;
    passportPath?: string | null;
}
