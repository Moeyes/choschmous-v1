'use client';

import { useState } from 'react';
import { ChevronLeft, Building2, Calendar, CheckCircle2, XCircle, Flag } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/Badge';
import { useTranslations } from 'next-intl';
import { useParticipationReview } from '../hooks';
import { StatusTimeline } from './StatusTimeline';
import { SubmissionReviewModal } from './SubmissionReviewModal';
import type { ParticipationPerSport, ParticipationStatus, ReviewAction } from '../types';

interface SubmissionDetailProps {
    submission: ParticipationPerSport;
    onBack: () => void;
}

// Mirror of the backend FSM (UX only — the server enforces transitions).
const ALLOWED: Record<string, ReviewAction[]> = {
    SUBMITTED: ['approve', 'reject', 'flag'],
    FLAGGED: ['approve', 'reject'],
    REVISION_REQUESTED: ['approve'],
    DRAFT: [],
    APPROVED: [],
    REJECTED: [],
};

const badgeVariant = (status: ParticipationStatus) =>
    status.toLowerCase() as 'submitted' | 'approved' | 'rejected' | 'flagged' | 'revision_requested' | 'draft';

export function SubmissionDetail({ submission, onBack }: SubmissionDetailProps) {
    const t = useTranslations('participation.review');
    const tStatus = useTranslations('participation.statuses');
    const { review, isReviewing } = useParticipationReview();
    const [current, setCurrent] = useState<ParticipationPerSport>(submission);
    const [reasonAction, setReasonAction] = useState<'reject' | 'flag' | null>(null);
    const [reason, setReason] = useState('');

    const status = (current.status ?? 'SUBMITTED') as ParticipationStatus;
    const allowed = ALLOWED[status] ?? [];

    const aM = current.athlete_male_count ?? 0;
    const aF = current.athlete_female_count ?? 0;
    const lM = current.leader_male_count ?? 0;
    const lF = current.leader_female_count ?? 0;
    const total = aM + aF + lM + lF;

    const doAction = (action: ReviewAction, note?: string) => {
        review(
            { id: current.id, payload: { action, note } },
            {
                onSuccess: (data) => {
                    setCurrent(data);
                    setReasonAction(null);
                    setReason('');
                },
            },
        );
    };

    const openReason = (action: 'reject' | 'flag') => {
        setReason('');
        setReasonAction(action);
    };

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={onBack}
                className="flex w-fit items-center gap-1.5 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-primary"
            >
                <ChevronLeft className="h-4 w-4" />
                {t('backToQueue')}
            </button>

            {/* Header */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <h1 className="text-xl font-semibold leading-snug text-foreground">
                                {current.org_name || '—'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 text-sm leading-relaxed text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {current.event_name || '—'}
                            <span className="text-border">·</span>
                            {t('submittedOn')} {new Date(current.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    <Badge variant={badgeVariant(status)} size="md">{tStatus(status)}</Badge>
                </div>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-6 text-sm font-semibold leading-snug text-foreground">{t('timeline')}</h2>
                <StatusTimeline status={status} />
                {current.review_note && (
                    <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
                        <p className="text-xs font-medium leading-relaxed text-muted-foreground">{t('reviewNote')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">{current.review_note}</p>
                        {current.reviewed_at && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {t('reviewedAt')} {new Date(current.reviewed_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Submitted data */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold leading-snug text-foreground">{t('submittedData')}</h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[360px] border-collapse text-sm">
                        <thead>
                            <tr className="bg-muted text-xs font-medium leading-relaxed text-muted-foreground">
                                <th className="px-4 py-3 text-left" />
                                <th className="px-4 py-3 text-right">{t('male')}</th>
                                <th className="px-4 py-3 text-right">{t('female')}</th>
                                <th className="border-l border-border px-4 py-3 text-right">{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card tabular-nums">
                            <tr>
                                <td className="px-4 py-3 font-medium leading-relaxed text-foreground">{t('athletes')}</td>
                                <td className="px-4 py-3 text-right text-foreground">{aM}</td>
                                <td className="px-4 py-3 text-right text-foreground">{aF}</td>
                                <td className="border-l border-border bg-muted/50 px-4 py-3 text-right font-semibold text-foreground">{aM + aF}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium leading-relaxed text-foreground">{t('leaders')}</td>
                                <td className="px-4 py-3 text-right text-foreground">{lM}</td>
                                <td className="px-4 py-3 text-right text-foreground">{lF}</td>
                                <td className="border-l border-border bg-muted/50 px-4 py-3 text-right font-semibold text-foreground">{lM + lF}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-border bg-muted text-sm font-semibold tabular-nums text-foreground">
                                <td className="px-4 py-3">{t('total')}</td>
                                <td className="px-4 py-3 text-right">{aM + lM}</td>
                                <td className="px-4 py-3 text-right">{aF + lF}</td>
                                <td className="border-l border-border bg-accent/60 px-4 py-3 text-right text-primary">{total}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Actions */}
            {allowed.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {allowed.includes('approve') && (
                        <Button
                            className="gap-2 bg-success text-white hover:bg-success/90 border-success"
                            loading={isReviewing}
                            onClick={() => doAction('approve')}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            {t('approve')}
                        </Button>
                    )}
                    {allowed.includes('reject') && (
                        <Button variant="destructive" className="gap-2" disabled={isReviewing} onClick={() => openReason('reject')}>
                            <XCircle className="h-4 w-4" />
                            {t('reject')}
                        </Button>
                    )}
                    {allowed.includes('flag') && (
                        <Button
                            className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90 border-warning"
                            disabled={isReviewing}
                            onClick={() => openReason('flag')}
                        >
                            <Flag className="h-4 w-4" />
                            {t('flag')}
                        </Button>
                    )}
                </div>
            )}

            <SubmissionReviewModal
              reasonAction={reasonAction}
              reason={reason}
              onReasonChange={setReason}
              onClose={() => setReasonAction(null)}
              onConfirm={() => reasonAction && doAction(reasonAction, reason.trim())}
              isReviewing={isReviewing}
            />
        </div>
    );
}
