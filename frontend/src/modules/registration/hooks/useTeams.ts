import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamHttpAdapter } from '../adapters/teamHttpAdapter';
import type { TeamPayload, TeamDetail, TeamListResponse } from '../types/team';

export function useTeams(event_id?: number, org_id?: number) {
    return useQuery<TeamListResponse>({
        queryKey: ['teams', event_id, org_id],
        queryFn: () => teamHttpAdapter.list(event_id, org_id),
        enabled: !!event_id,
        staleTime: 30_000,
    });
}

export function useTeam(team_id: number | undefined) {
    return useQuery<TeamDetail>({
        queryKey: ['team', team_id],
        queryFn: () => teamHttpAdapter.getById(team_id!),
        enabled: !!team_id,
        staleTime: 10_000,
    });
}

export function useCreateTeam() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: TeamPayload) => teamHttpAdapter.create(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['teams'] });
        },
    });
}

export function useAddTeamMember(team_id: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (enroll_id: number) => teamHttpAdapter.addMember(team_id, enroll_id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['team', team_id] });
            qc.invalidateQueries({ queryKey: ['teams'] });
        },
    });
}

export function useRemoveTeamMember(team_id: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (enroll_id: number) => teamHttpAdapter.removeMember(team_id, enroll_id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['team', team_id] });
            qc.invalidateQueries({ queryKey: ['teams'] });
        },
    });
}
