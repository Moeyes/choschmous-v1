'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { dashboardHttpAdapter } from '../adapters/dashboardHttpAdapter';
import { useAuth, UserRole } from '@/core/auth';

export function useDashboard() {
    const { user, role } = useAuth();
    const orgId = user?.organization_id ?? user?.org_id;

    return useQuery({
        queryKey: queryKeys.dashboard.scoped(role, orgId),
        queryFn: () => {
            const params: { orgId?: number; categoryId?: number } = {};
            if (role === UserRole.ORGANIZATION && orgId) {
                params.orgId = orgId;
            }
            return dashboardHttpAdapter.getDashboardData(params);
        },
        enabled: !!user,
        // The dashboard payload embeds recentEnrollments (names, gender, phone)
        // — Restricted-PII, so it is never cached past the screen
        // (data-governance §3/§5).
        staleTime: 0,
        gcTime:    0,
    });
}
