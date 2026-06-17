import type {
    SportSubmission,
    SportSubmissionListResponse,
    SportReviewPayload,
    SportSubmissionsFilter,
} from '../types';

export interface ISportSubmissionRepository {
    getAll(params?: SportSubmissionsFilter): Promise<SportSubmissionListResponse>;
    review(id: number, payload: SportReviewPayload): Promise<SportSubmission>;
}
