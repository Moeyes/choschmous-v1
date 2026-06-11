'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageHeader, PageShell } from '@/shared';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { ParticipationForm } from './ParticipationForm';
import { ParticipationList } from './ParticipationList';
import { SubmissionDetail } from './SubmissionDetail';
import { useTranslations } from 'next-intl';
import type { ParticipationPerSport } from '../types';

export function ParticipationPage() {
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState<ParticipationPerSport | null>(null);
    const { can } = usePermissions();
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const t = useTranslations('participation');
    const tReview = useTranslations('participation.review');

    // Admin sees the review queue; clicking a row opens the review detail.
    if (selected) {
        return (
            <PageShell size="wide">
                <SubmissionDetail
                    key={selected.id}
                    submission={selected}
                    onBack={() => setSelected(null)}
                />
            </PageShell>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader
                title={isAdmin ? tReview('queueTitle') : t('title')}
                description={isAdmin ? tReview('queueSubtitle') : t('description')}
                action={
                    <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'} className="gap-2">
                        {showForm ? <><X className="h-4 w-4" />{t('records.title')}</> : <><Plus className="h-4 w-4" />{t('addRecord')}</>}
                    </Button>
                }
            />
            {showForm && <div className="max-w-2xl"><ParticipationForm onSuccess={() => setShowForm(false)} /></div>}
            <ParticipationList onSelect={(s) => setSelected(s)} />
        </PageShell>
    );
}
