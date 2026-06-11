/**
 * Sport Feature - Types
 */

export interface Sport {
    id: number;
    name_kh: string;
    name_en?: string;
    description?: string;
    sport_type?: string;
    created_at?: string;
    updated_at?: string;
    // Calculated fields or from join
    category_count?: number;
}

export interface SportCreate {
    name_kh: string;
    name_en?: string;
    description?: string;
    sport_type?: string;
}

export enum Gender {
    MALE = "male",
    FEMALE = "female",
    OTHER = "other",
}

export interface Category {
    id: number;
    category: string;
    gender?: Gender | null;
    created_at?: string;
    sport_name?: string | null;
}

export interface AddCategoryBody {
    sport_id: number;
    category: string;
    gender?: Gender | null;
}

export interface UpdateCategoryBody extends Partial<AddCategoryBody> {
    id: number;
}

export interface DeleteCategoryBody {
    category_id: number;
}

export interface SportUpdate extends Partial<SportCreate> {
    id: number;
}

// ─── Participant-by-category view ────────────────────────────────────

export type ParticipantRole = 'athlete' | 'leader';

interface NamedRef {
    id: number;
    name: string;
}

/** A row returned by GET /api/participant/ (athlete or leader). */
export interface SportParticipant {
    participant_id: number;
    name_kh: string;
    name_en: string;
    gender: string;
    phone?: string | null;
    date_of_birth?: string | null;
    photoUrl?: string | null;
    role: ParticipantRole;
    sport?: NamedRef | null;
    organization?: NamedRef | null;
    event_id?: number | null;
    // athlete-only
    category?: NamedRef | null;
    // leader-only
    leader_role?: string | null;
}

interface SportParticipantListResponse {
    data: SportParticipant[];
    count: number;
}
