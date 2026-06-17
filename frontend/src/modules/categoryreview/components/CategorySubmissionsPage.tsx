'use client';

import { useState } from 'react';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';
import { CategorySubmissionList } from './CategorySubmissionList';
import { CategorySubmissionDetail } from './CategorySubmissionDetail';
import type { CategorySubmission } from '../types';

export function CategorySubmissionsPage() {
    const [selected, setSelected] = useState<CategorySubmission | null>(null);
    const t = useTranslations('categoryReview');

    if (selected) {
        return (
            <PageShell size="wide">
                <CategorySubmissionDetail key={selected.id} submission={selected} onBack={() => setSelected(null)} />
            </PageShell>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader title={t('queueTitle')} description={t('queueSubtitle')} />
            <CategorySubmissionList onSelect={(s) => setSelected(s)} />
        </PageShell>
    );
}
