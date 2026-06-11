import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiGetCard(pId: string, orgId: string, eventId: string) {
    const response = await apiClient.get(API.cards.byId(pId, orgId, eventId));
    return response.data;
}

export async function apiGetCards(orgId: string, eventId: string, params?: Record<string, unknown>) {
    const response = await apiClient.get(API.cards.list(orgId, eventId), { params });
    return response.data;
}
