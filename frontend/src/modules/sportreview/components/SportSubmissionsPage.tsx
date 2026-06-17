'use client';

import { useState } from 'react';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';
import { SportSubmissionList } from './SportSubmissionList';
import { SportSubmissionDetail } from './SportSubmissionDetail';
import type { SportSubmission } from '../types';

export function SportSubmissionsPage() {
    const [selected, setSelected] = useState<SportSubmission | null>(null);
    const t = useTranslations('sportReview');

    if (selected) {
        return (
            <PageShell size="wide">
                <SportSubmissionDetail key={selected.id} submission={selected} onBack={() => setSelected(null)} />
            </PageShell>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader title={t('queueTitle')} description={t('queueSubtitle')} />
            <SportSubmissionList onSelect={(s) => setSelected(s)} />
        </PageShell>
    );
}
