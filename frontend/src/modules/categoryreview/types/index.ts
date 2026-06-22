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

/** Bulk review of every pending submission for one sport. */
export interface CategorySportReviewPayload {
    action: 'approve' | 'reject';
    note?: string;
    event_id?: number;
}

export interface CategoryBulkReviewResult {
    updated: number;
    status: string;
}

/**
 * A client-side aggregation of {@link CategorySubmission} rows that share one
 * `sports_id`. By-category submissions have no organization, so the review queue
 * groups them by sport instead — one row per sport, with how many events it
 * submitted categories for.
 */
export interface CategorySportGroup {
    sports_id: number | null;
    sport_name?: string | null;
    submissions: CategorySubmission[];
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    /** FLAGGED / REVISION_REQUESTED / DRAFT — anything not in the three above. */
    other: number;
    /** Distinct event names across this sport's submissions. */
    eventNames: string[];
    latestSubmittedAt: string;
}

/** Group a flat submission list into one {@link CategorySportGroup} per sport. */
export function groupCategorySubmissionsBySport(
    submissions: CategorySubmission[],
): CategorySportGroup[] {
    const bySport = new Map<string, CategorySportGroup>();
    for (const s of submissions) {
        const key = String(s.sports_id ?? `name:${s.sport_name ?? ''}`);
        let g = bySport.get(key);
        if (!g) {
            g = {
                sports_id: s.sports_id ?? null,
                sport_name: s.sport_name,
                submissions: [],
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                other: 0,
                eventNames: [],
                latestSubmittedAt: s.created_at,
            };
            bySport.set(key, g);
        }
        g.submissions.push(s);
        g.total += 1;
        const st = (s.status ?? 'SUBMITTED') as CategorySubmissionStatus;
        if (st === 'SUBMITTED') g.pending += 1;
        else if (st === 'APPROVED') g.approved += 1;
        else if (st === 'REJECTED') g.rejected += 1;
        else g.other += 1;
        if (s.event_name && !g.eventNames.includes(s.event_name)) g.eventNames.push(s.event_name);
        if (s.created_at > g.latestSubmittedAt) g.latestSubmittedAt = s.created_at;
    }
    return Array.from(bySport.values()).sort(
        (a, b) => b.pending - a.pending || b.total - a.total,
    );
}

export interface CategorySubmissionListResponse {
    data: CategorySubmission[];
    count: number;
}

export interface CategorySubmissionsFilter {
    event_id?: number;
    status?: CategorySubmissionStatus;
    skip?: number;
    limit?: number;
}
