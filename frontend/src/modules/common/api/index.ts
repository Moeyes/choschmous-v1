import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiGetReviewPendingCount() {
    const response = await apiClient.get(API.dashboard.reviewPendingCount);
    return response.data;
}
