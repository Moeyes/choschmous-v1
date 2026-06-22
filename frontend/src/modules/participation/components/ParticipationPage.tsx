'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageHeader, PageShell } from '@/shared';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { ParticipationForm } from './ParticipationForm';
import { ParticipationList } from './ParticipationList';
import { ParticipationOrgList } from './ParticipationOrgList';
import { ParticipationOrgDetail } from './ParticipationOrgDetail';
import { SubmissionDetail } from './SubmissionDetail';
import { useTranslations } from 'next-intl';
import type { ParticipationPerSport, ParticipationOrgGroup } from '../types';

export function ParticipationPage() {
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState<ParticipationPerSport | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<ParticipationOrgGroup | null>(null);
    const { can } = usePermissions();
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const t = useTranslations('participation');
    const tReview = useTranslations('participation.review');

    // A single submission's review detail (reached from either flow).
    if (selected) {
        return (
            <PageShell size="wide">
                <SubmissionDetail key={selected.id} submission={selected} onBack={() => setSelected(null)} />
            </PageShell>
        );
    }

    // Admin: org review queue → one org's submissions → a single review.
    if (isAdmin) {
        if (selectedOrg) {
            return (
                <PageShell size="wide">
                    <ParticipationOrgDetail
                        key={selectedOrg.org_id ?? selectedOrg.org_name ?? 'org'}
                        group={selectedOrg}
                        onBack={() => setSelectedOrg(null)}
                        onSelectSubmission={(s) => setSelected(s)}
                    />
                </PageShell>
            );
        }
        return (
            <PageShell size="wide">
                <PageHeader title={tReview('queueTitle')} description={tReview('queueSubtitle')} />
                <ParticipationOrgList onSelectOrg={(g) => setSelectedOrg(g)} />
            </PageShell>
        );
    }

    // Organization user: manage their own enrollments (add / list / withdraw).
    return (
        <PageShell size="wide">
            <PageHeader
                title={t('title')}
                description={t('description')}
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
