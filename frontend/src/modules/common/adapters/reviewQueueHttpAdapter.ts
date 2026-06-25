import type { IReviewQueueRepository } from '../ports/IReviewQueueRepository';
import {
    reviewPendingCountResponseSchema,
    reviewPendingCountSchema,
} from '../schema/reviewQueue.schema';
import { apiGetReviewPendingCount } from '../api';

export const reviewQueueHttpAdapter: IReviewQueueRepository = {
    async getPendingCount() {
        const raw = await apiGetReviewPendingCount();
        const parsed = reviewPendingCountResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.success) {
            return parsed.data.data;
        }
        // Tolerate a bare (un-enveloped) payload shape too.
        return reviewPendingCountSchema.parse(raw);
    },
};
