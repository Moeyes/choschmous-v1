'use client';

import { PageShell } from '@/shared';
import { OrgList } from './OrgList';

export function OrganizationsPage() {
    return (
        <PageShell padded={false} size="wide">
            <OrgList />
        </PageShell>
    );
}
