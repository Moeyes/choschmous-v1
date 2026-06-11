'use client';

import { FileSpreadsheet } from 'lucide-react';
import { PageHeader, PageShell } from '@/shared';
import { ReportList } from './ReportList';
import { useTranslations } from 'next-intl';

export function ReportsPage() {
    const t = useTranslations('reports');
    return (
        <PageShell size="narrow">
            <PageHeader title={t('title')} description={t('description')} icon={FileSpreadsheet} />
            <ReportList />
        </PageShell>
    );
}
