'use client';

import { CreditCard } from 'lucide-react';
import { CardGrid } from './CardGrid';
import { PageHeader, PageShell } from '@/shared';
import { useTranslations } from 'next-intl';

export function CardsPage() {
    const t = useTranslations('cards');
    return (
        <PageShell padded={false} size="wide">
            <PageHeader title={t('title')} description={t('description')} icon={CreditCard} />
            <CardGrid />
        </PageShell>
    );
}
