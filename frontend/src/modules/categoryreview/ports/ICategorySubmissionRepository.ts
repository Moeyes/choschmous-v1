import type {
    CategorySubmissionListResponse,
    CategorySubmissionWithCategories,
    CategoryReviewPayload,
    CategorySportReviewPayload,
    CategoryBulkReviewResult,
    CategorySubmissionsFilter,
} from '../types';

export interface ICategorySubmissionRepository {
    getAll(params?: CategorySubmissionsFilter): Promise<CategorySubmissionListResponse>;
    getById(id: number): Promise<CategorySubmissionWithCategories>;
    review(id: number, payload: CategoryReviewPayload): Promise<CategorySubmissionWithCategories>;
    reviewSport(sportId: number, payload: CategorySportReviewPayload): Promise<CategoryBulkReviewResult>;
}
