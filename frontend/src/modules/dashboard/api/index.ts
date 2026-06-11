import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiGetDashboardData(params?: Record<string, unknown>) {
    const response = await apiClient.get(API.dashboard.data, { params });
    return response.data;
}
