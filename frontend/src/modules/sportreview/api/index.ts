import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { SportReviewPayload, SportOrgReviewPayload, SportSubmissionsFilter } from '../types';

export async function apiGetSportSubmissions(params?: SportSubmissionsFilter) {
    const { data } = await apiClient.get(API.sportSubmissions.list, { params });
    return data;
}

export async function apiReviewSportSubmission(id: number, payload: SportReviewPayload) {
    const { data } = await apiClient.patch(API.sportSubmissions.review(id), payload);
    return data;
}

export async function apiReviewSportOrg(orgId: number, payload: SportOrgReviewPayload) {
    const { data } = await apiClient.patch(API.sportSubmissions.reviewOrg(orgId), payload);
    return data;
}
