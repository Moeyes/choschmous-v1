'use client';

import { useState } from 'react';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';
import { SportSubmissionList } from './SportSubmissionList';
import { OrgSubmissionDetail } from './OrgSubmissionDetail';
import { SportSubmissionDetail } from './SportSubmissionDetail';
import type { SportOrgGroup, SportSubmission } from '../types';

export function SportSubmissionsPage() {
    // Two-level drill-down: org queue → one org's sports → one sport's review.
    const [selectedOrg, setSelectedOrg] = useState<SportOrgGroup | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<SportSubmission | null>(null);
    const t = useTranslations('sportReview');

    if (selectedSubmission) {
        return (
            <PageShell size="wide">
                <SportSubmissionDetail
                    key={selectedSubmission.id}
                    submission={selectedSubmission}
                    onBack={() => setSelectedSubmission(null)}
                />
            </PageShell>
        );
    }

    if (selectedOrg) {
        return (
            <PageShell size="wide">
                <OrgSubmissionDetail
                    key={selectedOrg.organization_id ?? selectedOrg.org_name ?? 'org'}
                    group={selectedOrg}
                    onBack={() => setSelectedOrg(null)}
                    onSelectSubmission={(s) => setSelectedSubmission(s)}
                />
            </PageShell>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader title={t('queueTitle')} description={t('queueSubtitle')} />
            <SportSubmissionList onSelectOrg={(g) => setSelectedOrg(g)} />
        </PageShell>
    );
}
