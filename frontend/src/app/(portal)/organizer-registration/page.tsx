'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { OrganizerRegistrationPage } from '@/modules/organizers';

export default function Page() {
    const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.organizerregistration);

    if (isLoading) return <PageLoadingState />;
    if (!hasRole) return null;

    return <OrganizerRegistrationPage />;
}
