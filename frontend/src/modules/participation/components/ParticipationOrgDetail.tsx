'use client';

import { useState } from 'react';
import { ChevronLeft, Building2, Calendar, Users, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable, SectionHeader, Badge } from '@/shared';
import { useTranslations } from 'next-intl';
import { SubmissionReviewModal } from './SubmissionReviewModal';
import { useParticipations, useParticipationOrgReview } from '../hooks';
import { groupParticipationsByOrg } from '../types';
import type { ParticipationOrgGroup, ParticipationPerSport, ParticipationStatus } from '../types';

const ADMIN_FETCH_LIMIT = 2000;

const STATUS_VARIANT: Record<ParticipationStatus, 'info' | 'success' | 'error' | 'warning' | 'muted'> = {
    SUBMITTED: 'info',
    APPROVED: 'success',
    REJECTED: 'error',
    FLAGGED: 'warning',
    REVISION_REQUESTED: 'warning',
    DRAFT: 'muted',
};

const athletes = (p: ParticipationPerSport) => (p.athlete_male_count ?? 0) + (p.athlete_female_count ?? 0);
const leaders = (p: ParticipationPerSport) => (p.leader_male_count ?? 0) + (p.leader_female_count ?? 0);

interface ParticipationOrgDetailProps {
    group: ParticipationOrgGroup;
    onBack: () => void;
    onSelectSubmission: (submission: ParticipationPerSport) => void;
}

export function ParticipationOrgDetail({ group, onBack, onSelectSubmission }: ParticipationOrgDetailProps) {
    const t = useTranslations('participation');
    const tStatus = useTranslations('participation.statuses');
    const { reviewOrg, isReviewing } = useParticipationOrgReview();
    const [reasonAction, setReasonAction] = useState<'reject' | null>(null);
    const [reason, setReason] = useState('');

    // Re-derive from the live query so org-level and per-item reviews reflect
    // the instant they invalidate the cache.
    const { data } = useParticipations({ skip: 0, limit: ADMIN_FETCH_LIMIT });
    const live = group.org_id != null ? (data?.data ?? []).filter((p) => p.org_id === group.org_id) : [];
    const current = live.length ? groupParticipationsByOrg(live)[0] : group;

    const canBulkReview = current.org_id != null && current.pending > 0;

    const doBulk = (action: 'approve' | 'reject', note?: string) => {
        if (current.org_id == null) return;
        reviewOrg(
            { orgId: current.org_id, payload: { action, note } },
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
                {t('backToOrgs')}
            </button>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <h1 className="text-xl font-semibold leading-snug text-foreground">{current.org_name || '—'}</h1>
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
                <SectionHeader title={t('orgSubmissions.title')} subtitle={t('orgSubmissions.subtitle')} icon={Users} />
                <DataTable
                    data={current.submissions}
                    rowKey={(p: ParticipationPerSport) => p.id}
                    onRowClick={(p) => onSelectSubmission(p)}
                    columns={[
                        {
                            header: t('columns.event'),
                            accessor: (p: ParticipationPerSport) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><Calendar className="h-4.5 w-4.5 text-primary" /></div>
                                    <div>
                                        <p className="text-sm font-medium leading-relaxed text-foreground">{p.event_name || '—'}</p>
                                        <p className="flex items-center gap-1 text-xs leading-relaxed text-muted-foreground">
                                            <Users className="h-3 w-3 text-primary/60" />
                                            {t('participantsSummary', { athletes: athletes(p), leaders: leaders(p) })}
                                        </p>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            header: t('columns.registered'),
                            accessor: (p: ParticipationPerSport) => <div className="text-sm leading-relaxed text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>,
                        },
                        {
                            header: t('orgColumns.status'),
                            accessor: (p: ParticipationPerSport) => {
                                const st = (p.status ?? 'SUBMITTED') as ParticipationStatus;
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
