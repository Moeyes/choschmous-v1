import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { OrganizerRegistrationPayload } from '../types';

export async function apiRegisterOrganizer(payload: OrganizerRegistrationPayload) {
    const { data } = await apiClient.post(API.organizer.register, payload);
    return data;
}

export async function apiListOrganizerRoles(activeOnly = true) {
    const { data } = await apiClient.get(API.organizer.roles, {
        params: activeOnly ? {} : { all: true },
    });
    return data;
}

export async function apiCreateOrganizerRole(payload: { name_kh: string; name_en: string; active?: boolean }) {
    const { data } = await apiClient.post(API.organizer.roles, payload);
    return data;
}

export async function apiUpdateOrganizerRole(id: number, payload: { name_kh?: string; name_en?: string; active?: boolean }) {
    const { data } = await apiClient.patch(API.organizer.roleById(id), payload);
    return data;
}
