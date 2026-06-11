import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiGetEvents() {
    const response = await apiClient.get(API.bynumber.events);
    return response.data;
}

export async function apiGetAllSports() {
    const response = await apiClient.get(API.bynumber.sports);
    return response.data;
}

export async function apiGetAllOrganizations() {
    const response = await apiClient.get(API.bynumber.organizations);
    return response.data;
}

export async function apiGetEventSports(eventId: number) {
    const response = await apiClient.get(API.bynumber.eventSports(eventId));
    return response.data;
}

export async function apiGetSportOrgs(eventId: number, sportId: number) {
    const response = await apiClient.get(API.bynumber.sportOrgs(eventId, sportId));
    return response.data;
}

export async function apiGetAllSportsList() {
    const response = await apiClient.get(API.bynumber.sportsList);
    return response.data;
}

export async function apiCreateParticipationPerSport(body: Record<string, unknown>) {
    await apiClient.post(API.bynumber.createParticipation, body);
}
