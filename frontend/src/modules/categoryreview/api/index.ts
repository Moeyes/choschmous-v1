import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { CategoryReviewPayload, CategorySportReviewPayload, CategorySubmissionsFilter } from '../types';

export async function apiGetCategorySubmissions(params?: CategorySubmissionsFilter) {
    const { data } = await apiClient.get(API.categorySubmissions.list, { params });
    return data;
}

export async function apiGetCategorySubmission(id: number) {
    const { data } = await apiClient.get(API.categorySubmissions.byId(id));
    return data;
}

export async function apiReviewCategorySubmission(id: number, payload: CategoryReviewPayload) {
    const { data } = await apiClient.patch(API.categorySubmissions.review(id), payload);
    return data;
}

export async function apiReviewCategorySport(sportId: number, payload: CategorySportReviewPayload) {
    const { data } = await apiClient.patch(API.categorySubmissions.reviewSport(sportId), payload);
    return data;
}
