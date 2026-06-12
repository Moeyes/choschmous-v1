import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiDownloadReport(
    key: string,
    params: Record<string, unknown>,
): Promise<Blob> {
    const response = await apiClient.get(API.reports.generate(key), {
        params,
        responseType: 'blob',
    });
    return response.data;
}

export async function apiGetSurveyStatus(eventId: number) {
    const { data } = await apiClient.get(API.events.surveyStatus(eventId));
    return data;
}
