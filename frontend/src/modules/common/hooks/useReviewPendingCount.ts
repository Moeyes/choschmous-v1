'use client';

/**
 * Pending-review count for the "Review queue" nav badge.
 *
 * TODO(review-count): there is no aggregate pending-count endpoint yet. When the
 * backend exposes one (e.g. a count across participation + sport/category
 * submissions awaiting review), wire it here through a port/adapter + React
 * Query and return the live number. Until then this returns 0 so the badge
 * renders nothing while the call site stays ready.
 */
export function useReviewPendingCount(): number {
    return 0;
}
