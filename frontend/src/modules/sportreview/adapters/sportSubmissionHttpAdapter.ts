import type { ISportSubmissionRepository } from '../ports/ISportSubmissionRepository';
import { sportSubmissionSchema, sportSubmissionListSchema } from '../schema/sportSubmission.schema';
import { apiGetSportSubmissions, apiReviewSportSubmission } from '../api';
import type {
    SportSubmission,
    SportSubmissionListResponse,
    SportReviewPayload,
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
};
