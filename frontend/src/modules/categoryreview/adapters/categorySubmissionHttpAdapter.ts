import type { ICategorySubmissionRepository } from '../ports/ICategorySubmissionRepository';
import {
    categorySubmissionListSchema,
    categorySubmissionDetailSchema,
    categoryBulkReviewResultSchema,
} from '../schema/categorySubmission.schema';
import {
    apiGetCategorySubmissions,
    apiGetCategorySubmission,
    apiReviewCategorySubmission,
    apiReviewCategorySport,
} from '../api';
import type {
    CategorySubmissionListResponse,
    CategorySubmissionWithCategories,
    CategoryReviewPayload,
    CategorySportReviewPayload,
    CategoryBulkReviewResult,
    CategorySubmissionsFilter,
} from '../types';

export const categorySubmissionHttpAdapter: ICategorySubmissionRepository = {
    getAll: async (params?: CategorySubmissionsFilter) => {
        const parsed = categorySubmissionListSchema.parse(await apiGetCategorySubmissions(params));
        return parsed as unknown as CategorySubmissionListResponse;
    },
    getById: async (id: number) => {
        const parsed = categorySubmissionDetailSchema.parse(await apiGetCategorySubmission(id));
        return parsed as unknown as CategorySubmissionWithCategories;
    },
    review: async (id: number, payload: CategoryReviewPayload) => {
        const parsed = categorySubmissionDetailSchema.parse(await apiReviewCategorySubmission(id, payload));
        return parsed as unknown as CategorySubmissionWithCategories;
    },
    reviewSport: async (sportId: number, payload: CategorySportReviewPayload) => {
        const parsed = categoryBulkReviewResultSchema.parse(await apiReviewCategorySport(sportId, payload));
        return parsed as unknown as CategoryBulkReviewResult;
    },
};
