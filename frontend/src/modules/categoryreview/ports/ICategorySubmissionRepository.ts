import type {
    CategorySubmissionListResponse,
    CategorySubmissionWithCategories,
    CategoryReviewPayload,
    CategorySubmissionsFilter,
} from '../types';

export interface ICategorySubmissionRepository {
    getAll(params?: CategorySubmissionsFilter): Promise<CategorySubmissionListResponse>;
    getById(id: number): Promise<CategorySubmissionWithCategories>;
    review(id: number, payload: CategoryReviewPayload): Promise<CategorySubmissionWithCategories>;
}
