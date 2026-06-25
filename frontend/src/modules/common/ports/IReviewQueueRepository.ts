import type { ReviewPendingCount } from '../schema/reviewQueue.schema';

export interface IReviewQueueRepository {
    /** Count of submissions awaiting admin review (0 for non-reviewers). */
    getPendingCount(): Promise<ReviewPendingCount>;
}
