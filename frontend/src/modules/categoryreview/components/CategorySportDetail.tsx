'use client';

import { useState } from 'react';
import { ChevronLeft, Trophy, Calendar, Layers, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable, SectionHeader, Badge } from '@/shared';
import { useTranslations } from 'next-intl';
import { SubmissionReviewModal } from '@/modules/participation';
import { useCategorySubmissions, useCategorySportReview } from '../hooks';
import { groupCategorySubmissionsBySport } from '../types';
import type { CategorySportGroup, CategorySubmission, CategorySubmissionStatus } from '../types';

const FETCH_LIMIT = 1000;

const STATUS_VARIANT: Record<CategorySubmissionStatus, 'info' | 'success' | 'error' | 'warning' | 'muted'> = {
    SUBMITTED: 'info',
    APPROVED: 'success',
    REJECTED: 'error',
    FLAGGED: 'warning',
    REVISION_REQUESTED: 'warning',
    DRAFT: 'muted',
};

interface CategorySportDetailProps {
    group: CategorySportGroup;
    onBack: () => void;
    onSelectSubmission: (submission: CategorySubmission) => void;
}

export function CategorySportDetail({ group, onBack, onSelectSubmission }: CategorySportDetailProps) {
    const t = useTranslations('categoryReview');
    const tStatus = useTranslations('participation.statuses');
    const { reviewSport, isReviewing } = useCategorySportReview();
    const [reasonAction, setReasonAction] = useState<'reject' | null>(null);
    const [reason, setReason] = useState('');

    // Re-derive from the live query so bulk and per-event reviews reflect at once.
    const { data } = useCategorySubmissions({ limit: FETCH_LIMIT });
    const live = group.sports_id != null ? (data?.data ?? []).filter((s) => s.sports_id === group.sports_id) : [];
    const current = live.length ? groupCategorySubmissionsBySport(live)[0] : group;

    const canBulkReview = current.sports_id != null && current.pending > 0;

    const doBulk = (action: 'approve' | 'reject', note?: string) => {
        if (current.sports_id == null) return;
        const event_id =
            current.eventNames.length === 1 && current.submissions[0]?.events_id != null
                ? current.submissions[0].events_id ?? undefined
                : undefined;
        reviewSport(
            { sportId: current.sports_id, payload: { action, note, event_id } },
            {
                onSuccess: () => {
                    setReasonAction(null);
                    setReason('');
                },
            },
        );
    };

    return (
        <div className="space-y-6">
            <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-primary">
                <ChevronLeft className="h-4 w-4" />
                {t('backToSports')}
            </button>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-primary" />
                            <h1 className="text-xl font-semibold leading-snug text-foreground">{current.sport_name || '—'}</h1>
                        </div>
                        <div className="flex items-center gap-2 text-sm leading-relaxed text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {current.eventNames.length > 1 ? t('nEvents', { count: current.eventNames.length }) : current.eventNames[0] || '—'}
                            <span className="text-border">·</span>
                            {t('nSubmissions', { count: current.total })}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {current.pending > 0 && <Badge variant="info" size="sm" dot>{t('nPending', { count: current.pending })}</Badge>}
                        {current.approved > 0 && <Badge variant="success" size="sm" dot>{t('nApproved', { count: current.approved })}</Badge>}
                        {current.rejected > 0 && <Badge variant="error" size="sm" dot>{t('nRejected', { count: current.rejected })}</Badge>}
                    </div>
                </div>

                {canBulkReview && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
                        <p className="text-sm leading-relaxed text-muted-foreground">{t('bulkPrompt', { count: current.pending })}</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button className="gap-2 bg-success text-white hover:bg-success/90 border-success" loading={isReviewing} onClick={() => doBulk('approve')}>
                                <CheckCircle2 className="h-4 w-4" />
                                {t('approveAll')}
                            </Button>
                            <Button variant="destructive" className="gap-2" disabled={isReviewing} onClick={() => { setReason(''); setReasonAction('reject'); }}>
                                <XCircle className="h-4 w-4" />
                                {t('rejectAll')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <SectionHeader title={t('sportSubmissions.title')} subtitle={t('sportSubmissions.subtitle')} icon={Layers} />
                <DataTable
                    data={current.submissions}
                    rowKey={(s: CategorySubmission) => s.id}
                    onRowClick={(s) => onSelectSubmission(s)}
                    columns={[
                        {
                            header: t('columns.event'),
                            accessor: (s: CategorySubmission) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><Calendar className="h-4.5 w-4.5 text-primary" /></div>
                                    <p className="text-sm font-medium leading-relaxed text-foreground">{s.event_name || '—'}</p>
                                </div>
                            ),
                        },
                        {
                            header: t('columns.categories'),
                            accessor: (s: CategorySubmission) => (
                                <span className="text-sm leading-relaxed tabular-nums text-foreground">{s.category_count}</span>
                            ),
                        },
                        {
                            header: t('columns.status'),
                            accessor: (s: CategorySubmission) => {
                                const st = (s.status ?? 'SUBMITTED') as CategorySubmissionStatus;
                                return <Badge variant={STATUS_VARIANT[st]}>{tStatus(st)}</Badge>;
                            },
                        },
                        {
                            header: '',
                            accessor: () => <ChevronRight className="h-4 w-4 text-muted-foreground" />,
                            className: 'w-10 text-right',
                            align: 'right',
                            hideOnMobile: true,
                        },
                    ]}
                />
            </div>

            <SubmissionReviewModal
                reasonAction={reasonAction}
                reason={reason}
                onReasonChange={setReason}
                onClose={() => setReasonAction(null)}
                onConfirm={() => reasonAction && doBulk(reasonAction, reason.trim())}
                isReviewing={isReviewing}
            />
        </div>
    );
}
