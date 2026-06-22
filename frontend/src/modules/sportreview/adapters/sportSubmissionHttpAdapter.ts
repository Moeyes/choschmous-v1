import type { ISportSubmissionRepository } from '../ports/ISportSubmissionRepository';
import {
    sportSubmissionSchema,
    sportSubmissionListSchema,
    sportOrgBulkReviewResultSchema,
} from '../schema/sportSubmission.schema';
import { apiGetSportSubmissions, apiReviewSportSubmission, apiReviewSportOrg } from '../api';
import type {
    SportSubmission,
    SportSubmissionListResponse,
    SportReviewPayload,
    SportOrgReviewPayload,
    SportOrgBulkReviewResult,
    SportSubmissionsFilter,
} from '../types';

export const sportSubmissionHttpAdapter: ISportSubmissionRepository = {
    getAll: async (params?: SportSubmissionsFilter) => {
        const parsed = sportSubmissionListSchema.parse(await apiGetSportSubmissions(params));
        return parsed as unknown as SportSubmissionListResponse;
    },
    review: async (id: number, payload: SportReviewPayload) => {
        const parsed = sportSubmissionSchema.parse(await apiReviewSportSubmission(id, payload));
        return parsed as unknown as SportSubmission;
    },
    reviewOrg: async (orgId: number, payload: SportOrgReviewPayload) => {
        const parsed = sportOrgBulkReviewResultSchema.parse(await apiReviewSportOrg(orgId, payload));
        return parsed as unknown as SportOrgBulkReviewResult;
    },
};
