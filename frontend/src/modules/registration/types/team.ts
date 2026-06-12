export interface TeamPayload {
    event_id: number;
    sport_id: number;
    org_id: number;
    category_id?: number | null;
    name: string;
}

export interface TeamMember {
    enroll_id: number;
    kh_family_name: string;
    kh_given_name: string;
    en_family_name: string;
    en_given_name: string;
    gender?: string | null;
    photo_url?: string | null;
    status?: string | null;
}

export interface TeamItem {
    id: number;
    event_id: number;
    sport_id: number;
    org_id: number;
    category_id?: number | null;
    name: string;
    member_count: number;
    created_at?: string | null;
}

export interface TeamDetail {
    id: number;
    event_id: number;
    sport_id: number;
    org_id: number;
    category_id?: number | null;
    name: string;
    member_count: number;
    members: TeamMember[];
    created_at?: string | null;
}

export interface TeamListResponse {
    data: TeamItem[];
    count: number;
}
