/**
 * By-category submission review types.
 *
 * A by-category submission is the set of `categories` a federation declared for
 * one (event, sport); its review state lives on a `category_survey_review`
 * header row. The backend FSM is identical to by-number, so the status/action
 * unions match participation's.
 */

export type CategorySubmissionStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'FLAGGED'
    | 'REVISION_REQUESTED';

export type CategoryReviewAction =
    | 'submit'
    | 'approve'
    | 'reject'
    | 'flag'
    | 'request_revision';

export type CategoryGender = 'MALE' | 'FEMALE' | 'MIXED';

export interface CategoryEntry {
    id: number;
    category: string;
    gender?: CategoryGender | null;
    sports_id?: number | null;
    events_id?: number | null;
    created_at: string;
}

export interface CategorySubmission {
    id: number;
    events_id?: number | null;
    sports_id?: number | null;
    event_name?: string | null;
    sport_name?: string | null;
    category_count: number;
    created_at: string;

    status?: CategorySubmissionStatus;
    review_note?: string | null;
    reviewed_at?: string | null;
}

export interface CategorySubmissionWithCategories extends CategorySubmission {
    categories: CategoryEntry[];
}

export interface CategoryReviewPayload {
    action: CategoryReviewAction;
    note?: string;
}

export interface CategorySubmissionListResponse {
    data: CategorySubmission[];
    count: number;
}

export interface CategorySubmissionsFilter {
    event_id?: number;
    status?: CategorySubmissionStatus;
}
