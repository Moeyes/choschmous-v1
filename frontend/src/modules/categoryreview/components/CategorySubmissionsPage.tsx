'use client';

import { useState } from 'react';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';
import { CategorySportList } from './CategorySportList';
import { CategorySportDetail } from './CategorySportDetail';
import { CategorySubmissionDetail } from './CategorySubmissionDetail';
import type { CategorySportGroup, CategorySubmission } from '../types';

export function CategorySubmissionsPage() {
    // Two-level drill-down: sport queue → one sport's events → one submission.
    const [selectedSport, setSelectedSport] = useState<CategorySportGroup | null>(null);
    const [selected, setSelected] = useState<CategorySubmission | null>(null);
    const t = useTranslations('categoryReview');

    if (selected) {
        return (
            <PageShell size="wide">
                <CategorySubmissionDetail key={selected.id} submission={selected} onBack={() => setSelected(null)} />
            </PageShell>
        );
    }

    if (selectedSport) {
        return (
            <PageShell size="wide">
                <CategorySportDetail
                    key={selectedSport.sports_id ?? selectedSport.sport_name ?? 'sport'}
                    group={selectedSport}
                    onBack={() => setSelectedSport(null)}
                    onSelectSubmission={(s) => setSelected(s)}
                />
            </PageShell>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader title={t('queueTitle')} description={t('queueSubtitle')} />
            <CategorySportList onSelectSport={(g) => setSelectedSport(g)} />
        </PageShell>
    );
}
