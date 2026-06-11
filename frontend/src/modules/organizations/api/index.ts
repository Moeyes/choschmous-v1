import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type {
    OrganizationCreate,
    OrganizationUpdateBody,
    OrganizationDeleteBody,
} from '../types';

export async function apiGetOrganizations(params?: Record<string, unknown>) {
    const { data } = await apiClient.get<unknown>(`${API.organizations.base}`, { params });
    return data;
}

export async function apiGetOrganizationById(orgId: number) {
    const { data } = await apiClient.get<unknown>(API.organizations.byId(orgId));
    return data;
}

export async function apiCreateOrganization(payload: OrganizationCreate) {
    const { data } = await apiClient.post<unknown>(`${API.organizations.base}`, payload);
    return data;
}

export async function apiUpdateOrganization(payload: OrganizationUpdateBody) {
    const { data } = await apiClient.patch<unknown>(API.organizations.update, payload);
    return data;
}

export async function apiDeleteOrganization(orgId: number): Promise<void> {
    const body: OrganizationDeleteBody = { org_id: orgId };
    await apiClient.delete(API.organizations.delete, { data: body });
}
