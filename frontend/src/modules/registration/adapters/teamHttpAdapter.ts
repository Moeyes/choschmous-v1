import apiClient from '@/core/api/client';
import type { TeamPayload, TeamDetail, TeamListResponse, TeamItem } from '../types/team';

const BASE = '/api/teams';

export const teamHttpAdapter = {
    async create(payload: TeamPayload): Promise<TeamItem> {
        const { data } = await apiClient.post(BASE, payload);
        return data;
    },

    async list(event_id?: number, organization_id?: number): Promise<TeamListResponse> {
        const params: Record<string, number> = {};
        if (event_id) params.event_id = event_id;
        if (organization_id) params.organization_id = organization_id;
        const { data } = await apiClient.get(BASE, { params });
        return data;
    },

    async getById(team_id: number): Promise<TeamDetail> {
        const { data } = await apiClient.get(`${BASE}/${team_id}`);
        return data;
    },

    async addMember(team_id: number, enroll_id: number): Promise<void> {
        await apiClient.post(`${BASE}/${team_id}/members`, { enroll_id });
    },

    async removeMember(team_id: number, enroll_id: number): Promise<void> {
        await apiClient.delete(`${BASE}/${team_id}/members/${enroll_id}`);
    },

    async delete(team_id: number): Promise<void> {
        await apiClient.delete(`${BASE}/${team_id}`);
    },
};
