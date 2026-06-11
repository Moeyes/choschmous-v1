'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useAuth, useRequireAuth, UserRole } from '@/core/auth';
import { PageShell, PageHeader, PageErrorState, SkeletonCard } from '@/shared';
import { useDashboard } from '../hooks/useDashboard';
import { GenderChart } from './GenderChart';
import { RecentEnrollments } from './RecentEnrollments';
import { StatsGrid } from './StatsGrid';
import { TopOrgsTable } from './TopOrgsTable';
import { useTranslations } from 'next-intl';

export function DashboardPage() {
    const { user, role } = useAuth();
    useRequireAuth();
    const { data, isLoading, error } = useDashboard();
    const t = useTranslations('dashboard');
    const tNav = useTranslations('nav');
    const tEvents = useTranslations('events');
    const tCommon = useTranslations('common');

    if (!user) return null;

    const isAdmin = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

    let quickAction: ReactNode = null;
    if (isAdmin) {
        quickAction = (
            <Link href="/events">
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {tEvents('createEvent')}
                </Button>
            </Link>
        );
    } else if (role === UserRole.ORGANIZATION) {
        quickAction = (
            <Link href="/by-sport">
                <Button className="gap-2">
                    {tNav('bysport')}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </Link>
        );
    } else if (role === UserRole.FEDERATION) {
        quickAction = (
            <Link href="/by-category">
                <Button className="gap-2">
                    {tNav('bycategory')}
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </Link>
        );
    }

    return (
        <PageShell size="wide">
            <PageHeader
                title={t('title')}
                description={t('welcomeBack', { name: user.kh_given_name || user.khmer_name || user.username })}
                icon={LayoutDashboard}
                action={quickAction}
            />

            {isLoading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-1">
                            <SkeletonCard className="h-[400px]" />
                        </div>
                        <div className="lg:col-span-1">
                            <SkeletonCard className="h-[400px]" />
                        </div>
                        <div className="lg:col-span-1">
                            <SkeletonCard className="h-[400px]" />
                        </div>
                    </div>
                </div>
            ) : error ? (
                <PageErrorState title={t('failedToLoad')} description={tCommon('connectionError')} />
            ) : data ? (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <StatsGrid stats={data.stats} />

                    {/* Charts & Tables Section */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Gender Distribution — takes 1 col on desktop */}
                        <div className="lg:col-span-1">
                            <GenderChart data={data.genderDistribution} />
                        </div>

                        {/* Top Organizations — takes 1 col on desktop */}
                        <div className="lg:col-span-1">
                            <TopOrgsTable data={data.topOrganizations} />
                        </div>

                        {/* Recent Enrollments — takes 1 col on desktop */}
                        <div className="lg:col-span-1">
                            <RecentEnrollments data={data.recentEnrollments} />
                        </div>
                    </div>
                </div>
            ) : null}
        </PageShell>
    );
}
