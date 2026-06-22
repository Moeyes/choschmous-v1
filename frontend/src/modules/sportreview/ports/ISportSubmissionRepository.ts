import type {
    SportSubmission,
    SportSubmissionListResponse,
    SportReviewPayload,
    SportOrgReviewPayload,
    SportOrgBulkReviewResult,
    SportSubmissionsFilter,
} from '../types';

export interface ISportSubmissionRepository {
    getAll(params?: SportSubmissionsFilter): Promise<SportSubmissionListResponse>;
    review(id: number, payload: SportReviewPayload): Promise<SportSubmission>;
    reviewOrg(orgId: number, payload: SportOrgReviewPayload): Promise<SportOrgBulkReviewResult>;
}
