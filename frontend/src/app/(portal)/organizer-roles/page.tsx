'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { OrganizerRoleManager } from '@/modules/organizers';

export default function Page() {
    const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.organizerroles);

    if (isLoading) return <PageLoadingState />;
    if (!hasRole) return null;

    return <OrganizerRoleManager />;
}
