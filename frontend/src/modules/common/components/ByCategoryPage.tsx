'use client';

import { Layers } from 'lucide-react';
import { ContentPanel, PageEmptyState, PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';

export function ByCategoryPage() {
    const t = useTranslations('bycategory');
    return (
        <PageShell size="wide">
            <PageHeader title={t('title')} description={t('description')} icon={Layers} />
            <ContentPanel>
                <PageEmptyState title={t('comingSoon')} description={t('comingSoonDesc')} className="border-0 p-12 shadow-none" />
            </ContentPanel>
        </PageShell>
    );
}
