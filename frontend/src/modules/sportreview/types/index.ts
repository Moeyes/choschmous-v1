/**
 * By-sport submission review types.
 *
 * A by-sport submission is a `sports_event_org` row — an organization's
 * declaration that it will participate in a sport for an event. The admin
 * review backend supports approve/reject only (NOT the full by-number FSM), so
 * the action/status unions are intentionally narrower than participation's.
 */

export type SportSubmissionStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type SportReviewAction = 'approve' | 'reject';

export interface SportSubmission {
    id: number;
    events_id?: number | null;
    sports_id?: number | null;
    organization_id?: number | null;
    created_at: string;

    // Review state
    status?: SportSubmissionStatus;
    review_note?: string | null;
    reviewed_at?: string | null;

    // Enriched names joined in by the backend
    org_name?: string | null;
    sport_name?: string | null;
    event_name?: string | null;
}

export interface SportReviewPayload {
    action: SportReviewAction;
    note?: string;
}

export interface SportSubmissionListResponse {
    data: SportSubmission[];
    count: number;
}

export interface SportSubmissionsFilter {
    event_id?: number;
    status?: SportSubmissionStatus;
}
