/**
 * Participation Per Sport Types
 */

export type ParticipationStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'FLAGGED'
    | 'REVISION_REQUESTED';

export type ReviewAction =
    | 'submit'
    | 'approve'
    | 'reject'
    | 'flag'
    | 'request_revision';

export interface ParticipationPerSport {
    id: number;
    enroll_id: number;
    sport_id: number;
    event_id: number;
    org_id?: number;
    category_id?: number | null;
    created_at: string;

    // Review FSM
    status?: ParticipationStatus;
    review_note?: string | null;
    reviewed_at?: string | null;

    // Participant count breakdown (returned by backend)
    athlete_male_count?: number | null;
    athlete_female_count?: number | null;
    leader_male_count?: number | null;
    leader_female_count?: number | null;

    // Enriched fields from backend
    org_name?: string;
    event_name?: string;
    sport_name?: string;
    category_name?: string;
    participant_name?: string;
}

export interface ParticipationReviewPayload {
    action: ReviewAction;
    note?: string;
}

export interface ParticipationPerSportPayload {
    enroll_id: number;
    sport_id: number;
    event_id: number;
    category_id?: number | null;
}

export interface ParticipationPerSportListResponse {
    data: ParticipationPerSport[];
    count: number;
}
