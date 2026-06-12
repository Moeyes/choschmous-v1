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

export interface OrganizerResponse {
    enroll_id: number;
    organizer_participation_id: number;
    organizer_role_id: number;
    role_name_en: string;
    role_name_kh: string;
    event_id: number;
    organization_id: number | null;
    kh_family_name: string;
    kh_given_name: string;
    created_at: string;
}
