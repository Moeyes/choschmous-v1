import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiDownloadOrgSportReport(params: Record<string, unknown>): Promise<Blob> {
    const response = await apiClient.get(API.reports.orgSport, {
        params,
        responseType: 'blob',
    });
    return response.data;
}

export async function apiDownloadOrgSportParticipantReport(params: Record<string, unknown>): Promise<Blob> {
    const response = await apiClient.get(API.reports.orgSportParticipant, {
        params,
        responseType: 'blob',
    });
    return response.data;
}
