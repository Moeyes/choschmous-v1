import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { ParticipationPerSportPayload, ParticipationReviewPayload } from '../types';

export async function apiCreateParticipation(payload: ParticipationPerSportPayload) {
    const { data } = await apiClient.post(`${API.participation.base}`, payload);
    return data;
}

export async function apiGetParticipations(params?: Record<string, unknown>) {
    const { data } = await apiClient.get(`${API.participation.base}`, { params });
    return data;
}

export async function apiGetParticipation(id: number) {
    const { data } = await apiClient.get(API.participation.byId(id));
    return data;
}

export async function apiUpdateParticipation(id: number, payload: Record<string, unknown>) {
    const { data } = await apiClient.patch(API.participation.byId(id), payload);
    return data;
}

export async function apiDeleteParticipation(id: number) {
    const { data } = await apiClient.delete(API.participation.byId(id));
    return data;
}

export async function apiReviewParticipation(id: number, payload: ParticipationReviewPayload) {
    const { data } = await apiClient.patch(API.participation.review(id), payload);
    return data;
}
