import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { UserCreate, UserUpdate } from '../types';

export async function apiGetUsers(params?: Record<string, unknown>) {
    const { data } = await apiClient.get<unknown>(`${API.users.base}`, { params });
    return data;
}

export async function apiGetUserById(userId: string) {
    const { data } = await apiClient.get<unknown>(API.users.byId(userId));
    return data;
}

export async function apiCreateUser(payload: UserCreate) {
    const { data } = await apiClient.post<unknown>(`${API.users.base}`, payload);
    return data;
}

export async function apiUpdateUser(payload: UserUpdate) {
    const { id, ...fields } = payload;
    const { data } = await apiClient.patch<unknown>(API.users.update, {
        user_id: id,
        data: fields,
    });
    return data;
}

export async function apiDeleteUser(userId: string): Promise<void> {
    await apiClient.delete(API.users.delete, { data: { user_id: userId } });
}
