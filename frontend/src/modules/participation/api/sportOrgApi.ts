import apiClient from '@/core/api/client';

export async function apiGetSportOrgSubmissions(params?: { event_id?: number; status?: string }) {
    const { data } = await apiClient.get('/api/events/sport-org/submissions', { params });
    return data;
}

export async function apiReviewSportOrg(id: number, payload: { action: string; note?: string }) {
    const { data } = await apiClient.patch(`/api/events/sport-org/${id}/review`, payload);
    return data;
}
