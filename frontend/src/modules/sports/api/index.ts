import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type {
    SportCreate, SportUpdate,
    AddCategoryBody, UpdateCategoryBody, DeleteCategoryBody,
} from '../types';

export async function apiGetSports(params?: Record<string, unknown>) {
    const { data } = await apiClient.get<unknown>(API.sports.base, { params });
    return data;
}

export async function apiGetSportById(sportId: number) {
    const { data } = await apiClient.get<unknown>(API.sports.byId(sportId));
    return data;
}

export async function apiCreateSport(payload: SportCreate) {
    const { data } = await apiClient.post<unknown>(API.sports.base, payload);
    return data;
}

export async function apiUpdateSport(payload: SportUpdate) {
    const { id, ...fields } = payload;
    const { data } = await apiClient.patch<unknown>(API.sports.byId(id), fields);
    return data;
}

export async function apiDeleteSport(sportId: number): Promise<void> {
    await apiClient.delete(API.sports.byId(sportId));
}

export async function apiGetCategoriesBySportId(sportId: number) {
    const { data } = await apiClient.get<unknown>(API.sports.categories(sportId));
    return data;
}

export async function apiGetCategoryById(categoryId: number) {
    const { data } = await apiClient.get<unknown>(`${API.sports.category}/${categoryId}`);
    return data;
}

export async function apiAddCategory(payload: AddCategoryBody) {
    const { data } = await apiClient.post<unknown>(API.sports.category, payload);
    return data;
}

export async function apiUpdateCategory(payload: UpdateCategoryBody) {
    const { data } = await apiClient.patch<unknown>(API.sports.category, payload);
    return data;
}

export async function apiDeleteCategory(payload: DeleteCategoryBody): Promise<void> {
    await apiClient.delete(API.sports.category, { data: payload });
}

export async function apiGetParticipants(params: Record<string, unknown>) {
    const { data } = await apiClient.get<unknown>(`${API.participant.base}`, { params });
    return data;
}
