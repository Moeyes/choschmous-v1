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

/** Bulk review of every pending submission belonging to one organization. */
export interface ParticipationOrgReviewPayload {
    action: 'approve' | 'reject';
    note?: string;
}

export interface ParticipationBulkReviewResult {
    updated: number;
    status: string;
}

/**
 * A client-side aggregation of {@link ParticipationPerSport} rows that share one
 * `org_id`. The admin review queue groups them so reviewers see one row per
 * organization and how many submissions it has, mirroring /sport-submissions.
 */
export interface ParticipationOrgGroup {
    org_id: number | null;
    org_name?: string;
    submissions: ParticipationPerSport[];
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    /** FLAGGED / REVISION_REQUESTED / DRAFT — anything not in the three above. */
    other: number;
    /** Distinct event names across this org's submissions. */
    eventNames: string[];
    latestSubmittedAt: string;
}

/** Group a flat participation list into one {@link ParticipationOrgGroup} per org. */
export function groupParticipationsByOrg(
    rows: ParticipationPerSport[],
): ParticipationOrgGroup[] {
    const byOrg = new Map<string, ParticipationOrgGroup>();
    for (const r of rows) {
        const key = String(r.org_id ?? `name:${r.org_name ?? ''}`);
        let g = byOrg.get(key);
        if (!g) {
            g = {
                org_id: r.org_id ?? null,
                org_name: r.org_name,
                submissions: [],
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                other: 0,
                eventNames: [],
                latestSubmittedAt: r.created_at,
            };
            byOrg.set(key, g);
        }
        g.submissions.push(r);
        g.total += 1;
        const st = (r.status ?? 'SUBMITTED') as ParticipationStatus;
        if (st === 'SUBMITTED') g.pending += 1;
        else if (st === 'APPROVED') g.approved += 1;
        else if (st === 'REJECTED') g.rejected += 1;
        else g.other += 1;
        if (r.event_name && !g.eventNames.includes(r.event_name)) g.eventNames.push(r.event_name);
        if (r.created_at > g.latestSubmittedAt) g.latestSubmittedAt = r.created_at;
    }
    return Array.from(byOrg.values()).sort(
        (a, b) => b.pending - a.pending || b.total - a.total,
    );
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
