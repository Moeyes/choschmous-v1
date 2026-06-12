'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { apiListOrganizerRoles, apiCreateOrganizerRole, apiUpdateOrganizerRole } from '../api';
import type { OrganizerRole } from '../types';

export function useOrganizerRoles(activeOnly = true) {
    return useQuery<OrganizerRole[]>({
        queryKey: queryKeys.organizerRoles.list(activeOnly),
        queryFn: () => apiListOrganizerRoles(activeOnly),
        staleTime: 60_000,
    });
}

export function useCreateOrganizerRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: { name_kh: string; name_en: string }) => apiCreateOrganizerRole(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.organizerRoles.all }),
    });
}

export function useUpdateOrganizerRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...payload }: { id: number; name_kh?: string; name_en?: string; active?: boolean }) =>
            apiUpdateOrganizerRole(id, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.organizerRoles.all }),
    });
}
