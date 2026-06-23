'use client';

import { CalendarClock, ClipboardCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/shared/ui';
import { useReviewPendingCount } from '@/modules/common/hooks';
import { useRegistrationWindow } from '../hooks/useRegistrationWindow';

interface DashboardInsightsProps {
    isAdmin: boolean;
}

/**
 * Role-aware status widgets shown above the dashboard charts: a pending-review
 * count card (admins) and a registration-window status line. Both read from
 * lightweight hooks that return honest empty/neutral state until their
 * endpoints exist — no fabricated figures.
 */
export function DashboardInsights({ isAdmin }: DashboardInsightsProps) {
    const t = useTranslations('dashboard');
    const pendingCount = useReviewPendingCount();
    const { data: registrationWindow } = useRegistrationWindow();

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isAdmin && (
                <StatCard
                    label={t('pendingReview')}
                    value={pendingCount}
                    icon={ClipboardCheck}
                    color="amber"
                    description={t('pendingReviewHint')}
                />
            )}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <CalendarClock className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading">{t('registrationWindow')}</p>
                    <p className="truncate text-sm text-muted-text">
                        {t(`registrationStatus.${registrationWindow.status}` as never)}
                    </p>
                </div>
            </div>
        </div>
    );
}
