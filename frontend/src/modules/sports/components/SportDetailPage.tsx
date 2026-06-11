'use client';

import Link from 'next/link';
import { LayoutDashboard, Trophy } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ContentPanel, DetailHeader, PageLoadingState, PageNotFound, PageShell } from '@/shared';
import { useAuth, UserRole } from '@/core/auth';
import { useSportDetail } from '../hooks';
import { CategoryList } from './CategoryList';
import { useTranslations } from 'next-intl';

interface SportDetailPageProps { sportId: number; }

export function SportDetailPage({ sportId }: SportDetailPageProps) {
    const { data: sport, isLoading } = useSportDetail(sportId);
    const { user, hasRole } = useAuth();
    const t = useTranslations('sports');
    const tCommon = useTranslations('common');

    // Federation users may only open their own sport.
    const blockedForFederation = hasRole([UserRole.FEDERATION]) && user?.sport_id !== sportId;

    if (isLoading) return <PageLoadingState />;
    if (blockedForFederation || !sport) return (
        <PageNotFound title={t('sportNotFound')} action={<Link href="/sports" className="text-primary hover:underline">{t('backToSports')}</Link>} />
    );

    return (
        <PageShell padded={false} size="wide">
            <DetailHeader
                backHref="/sports" backLabel={t('backToSports')}
                eyebrow={sport.sport_type || t('sportDiscipline')} eyebrowIcon={Trophy}
                title={sport.name_kh}
                action={
                    <Link href="/dashboard">
                        <Button variant="outline" className="gap-2"><LayoutDashboard className="h-4 w-4" />{tCommon('dashboard')}</Button>
                    </Link>
                }
            />
            <ContentPanel className="min-h-100">
                <CategoryList sportId={sportId} />
            </ContentPanel>
        </PageShell>
    );
}
