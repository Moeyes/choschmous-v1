import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type {
    AddSportToEventPayload, AddOrgToEventSportPayload,
    RemoveOrgCompletelyFromEventPayload,
} from '../types';

export async function apiGetEvents(params?: Record<string, unknown>) {
    const { data } = await apiClient.get<unknown>(`${API.events.base}`, { params });
    return data;
}

export async function apiGetEventById(eventId: number) {
    const { data } = await apiClient.get<unknown>(API.events.byId(eventId));
    return data;
}

/**
 * Public, unauthenticated fetch of a single event — safe to call during SSR
 * (e.g. generateMetadata). On the server, apiClient's relative baseURL ('/')
 * has no origin, so we prefix the absolute API URL; in the browser the path
 * stays relative.
 */
export async function apiGetPublicEventById(eventId: number) {
    const base =
        typeof window === 'undefined'
            ? (process.env.API_URL ?? 'http://localhost:8000')
            : '';
    const { data } = await apiClient.get<unknown>(`${base}${API.events.publicById(eventId)}`);
    return data;
}

export async function apiCreateEvent(payload: Record<string, unknown>) {
    const { data } = await apiClient.post<unknown>(`${API.events.base}`, payload);
    return data;
}

export async function apiUpdateEvent(id: number, payload: Record<string, unknown>) {
    const { data } = await apiClient.patch<unknown>(API.events.byId(id), payload);
    return data;
}

export async function apiDeleteEvent(eventId: number): Promise<void> {
    await apiClient.delete(API.events.delete, { data: { event_id: eventId } });
}

export async function apiUpdateEventPhase(id: number, payload: Record<string, unknown>) {
    const { data } = await apiClient.patch<unknown>(API.events.phase(id), payload);
    return data;
}

export async function apiAddSportToEvent(payload: AddSportToEventPayload) {
    await apiClient.post(API.events.addSport, {
        events_id: payload.event_id,
        sports_id: payload.sport_id,
    });
}

export async function apiGetEventSports(eventId: number) {
    const { data } = await apiClient.get<unknown>(API.events.sports(eventId));
    return data;
}

export async function apiRemoveSportFromEvent(associationId: number): Promise<void> {
    await apiClient.delete(API.events.removeSport, {
        data: { association_id: associationId },
    });
}

export async function apiGetEventSportOrgs(eventId: number, sportId: number): Promise<unknown> {
    const { data } = await apiClient.get<unknown>(API.events.sportOrgs(eventId, sportId));
    return data;
}

export async function apiAddOrgToEventSport(payload: AddOrgToEventSportPayload) {
    await apiClient.post(API.events.addOrgToSport, {
        events_id: payload.event_id,
        sports_id: payload.sport_id,
        org_id: payload.org_id,
    });
}

export async function apiDeleteEventSportOrgLink(associationId: number): Promise<void> {
    await apiClient.delete(API.events.deleteOrgLink, {
        data: { association_id: associationId },
    });
}

export async function apiGetEventOrganizations(eventId: number) {
    const { data } = await apiClient.get<unknown>(API.events.organizations(eventId));
    return data;
}

export async function apiRemoveOrgCompletelyFromEvent(payload: RemoveOrgCompletelyFromEventPayload): Promise<void> {
    await apiClient.delete(API.events.removeOrgCompletely, { data: payload });
}

export async function apiGetEventSportCategories(eventId: number, sportId: number) {
    const { data } = await apiClient.get<unknown>(API.events.sportCategories(eventId, sportId));
    return data;
}
