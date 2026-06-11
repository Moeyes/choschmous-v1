import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiGetEvents() {
    const response = await apiClient.get(API.survey.events);
    return response.data;
}

export async function apiGetAllSports() {
    const response = await apiClient.get(API.survey.sports);
    return response.data;
}

export async function apiGetAllOrganizations() {
    const response = await apiClient.get(API.survey.organizations);
    return response.data;
}

export async function apiGetEventSports(eventId: number) {
    const response = await apiClient.get(API.survey.eventSports(eventId));
    return response.data;
}

export async function apiAddOrgToSport(body: { org_id: number; events_id: number; sports_id: number }) {
    await apiClient.post(API.survey.addOrgToSport, body);
}
