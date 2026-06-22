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

/** Bulk review of every pending submission belonging to one organization. */
export interface SportOrgReviewPayload {
    action: SportReviewAction;
    note?: string;
    event_id?: number;
}

export interface SportOrgBulkReviewResult {
    updated: number;
    status: string;
}

/**
 * A client-side aggregation of {@link SportSubmission} rows that share one
 * `organization_id`. The list endpoint is per-(org × sport); the queue groups
 * them so admins see one row per organization and how many sports it submitted.
 */
export interface SportOrgGroup {
    organization_id: number | null;
    org_name?: string | null;
    submissions: SportSubmission[];
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    /** Distinct event names across this org's submissions. */
    eventNames: string[];
    /** Most recent submission date across the group. */
    latestSubmittedAt: string;
}

/** Group a flat submission list into one {@link SportOrgGroup} per organization. */
export function groupSubmissionsByOrg(submissions: SportSubmission[]): SportOrgGroup[] {
    const byOrg = new Map<string, SportOrgGroup>();
    for (const s of submissions) {
        const key = String(s.organization_id ?? `name:${s.org_name ?? ''}`);
        let g = byOrg.get(key);
        if (!g) {
            g = {
                organization_id: s.organization_id ?? null,
                org_name: s.org_name,
                submissions: [],
                total: 0,
                approved: 0,
                rejected: 0,
                pending: 0,
                eventNames: [],
                latestSubmittedAt: s.created_at,
            };
            byOrg.set(key, g);
        }
        g.submissions.push(s);
        g.total += 1;
        const st = (s.status ?? 'SUBMITTED') as SportSubmissionStatus;
        if (st === 'APPROVED') g.approved += 1;
        else if (st === 'REJECTED') g.rejected += 1;
        else g.pending += 1;
        if (s.event_name && !g.eventNames.includes(s.event_name)) g.eventNames.push(s.event_name);
        if (s.created_at > g.latestSubmittedAt) g.latestSubmittedAt = s.created_at;
    }
    // Pending-first, then largest orgs, so the work that needs attention floats up.
    return Array.from(byOrg.values()).sort(
        (a, b) => b.pending - a.pending || b.total - a.total,
    );
}

export interface SportSubmissionListResponse {
    data: SportSubmission[];
    count: number;
}

export interface SportSubmissionsFilter {
    event_id?: number;
    organization_id?: number;
    status?: SportSubmissionStatus;
}
