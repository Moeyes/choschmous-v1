/**
 * Organization Feature - Types
 */

export enum InstituteType {
    PROVINCE = "province",
    MINISTRY = "ministry",
    FEDERATION = "federation",
    UNIVERSITY = "university",
}

interface Organization {
    id: number;
    name_kh: string;
    name_en?: string;
    type: InstituteType;
    code?: string;
    created_at?: string;
}

export interface OrganizationCreate {
    name_kh: string;
    name_en?: string;
    type: InstituteType;
}

export interface OrganizationUpdateBody extends Partial<OrganizationCreate> {
    id: number;
}

export interface OrganizationDeleteBody {
    org_id: number;
}

interface OrganizationsResponse {
    data: Organization[];
    count: number;
}
