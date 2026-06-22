'use client';

import { useState } from 'react';
import { ChevronLeft, Building2, Calendar, Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/Badge';
import { useTranslations } from 'next-intl';
// Reuse the by-number reference's presentational review pieces (do not modify
// them) so the by-sport queue matches /participation exactly.
import { StatusTimeline, SubmissionReviewModal } from '@/modules/participation';
import { useSportSubmissionReview } from '../hooks';
import type { SportSubmission, SportSubmissionStatus, SportReviewAction } from '../types';

interface SportSubmissionDetailProps {
    submission: SportSubmission;
    onBack: () => void;
}

// Mirror of the by-sport backend (approve/reject only — UX gate, server re-checks).
const ALLOWED: Record<string, SportReviewAction[]> = {
    SUBMITTED: ['approve', 'reject'],
    APPROVED: [],
    REJECTED: [],
};

const STATUS_VARIANT: Record<SportSubmissionStatus, "info" | "success" | "error"> = {
    SUBMITTED: "info",
    APPROVED: "success",
    REJECTED: "error",
};

const badgeVariant = (status: SportSubmissionStatus) => STATUS_VARIANT[status];

export function SportSubmissionDetail({ submission, onBack }: SportSubmissionDetailProps) {
    const t = useTranslations('sportReview');
    const tReview = useTranslations('participation.review');
    const tStatus = useTranslations('participation.statuses');
    const { review, isReviewing } = useSportSubmissionReview();
    const [current, setCurrent] = useState<SportSubmission>(submission);
    const [reasonAction, setReasonAction] = useState<'reject' | null>(null);
    const [reason, setReason] = useState('');

    const status = (current.status ?? 'SUBMITTED') as SportSubmissionStatus;
    const allowed = ALLOWED[status] ?? [];

    const doAction = (action: SportReviewAction, note?: string) => {
        review(
            { id: current.id, payload: { action, note } },
            {
                // The review response carries the updated status but no joined
                // names — keep the names already loaded with the row.
                onSuccess: (data) => {
                    setCurrent((prev) => ({
                        ...prev,
                        status: data.status,
                        review_note: data.review_note,
                        reviewed_at: data.reviewed_at,
                    }));
                    setReasonAction(null);
                    setReason('');
                },
            },
        );
    };

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={onBack}
                className="flex w-fit items-center gap-1.5 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-primary"
            >
                <ChevronLeft className="h-4 w-4" />
                {tReview('backToQueue')}
            </button>

            {/* Header */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <h1 className="text-xl font-semibold leading-snug text-foreground">{current.org_name || '—'}</h1>
                        </div>
                        <div className="flex items-center gap-2 text-sm leading-relaxed text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {current.event_name || '—'}
                            <span className="text-border">·</span>
                            {tReview('submittedOn')} {new Date(current.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    <Badge variant={badgeVariant(status)} size="md">{tStatus(status)}</Badge>
                </div>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-6 text-sm font-semibold leading-snug text-foreground">{tReview('timeline')}</h2>
                <StatusTimeline status={status} />
                {current.review_note && (
                    <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
                        <p className="text-xs font-medium leading-relaxed text-muted-foreground">{tReview('reviewNote')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">{current.review_note}</p>
                        {current.reviewed_at && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {tReview('reviewedAt')} {new Date(current.reviewed_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Submitted data — the sport declaration (by-sport's own shape) */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold leading-snug text-foreground">{t('declaration')}</h2>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <dt className="text-xs font-medium leading-relaxed text-muted-foreground">{t('columns.organization')}</dt>
                        <dd className="mt-1 flex items-center gap-2 text-sm leading-relaxed text-foreground"><Building2 className="h-3.5 w-3.5 text-primary/60" />{current.org_name || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium leading-relaxed text-muted-foreground">{t('columns.sport')}</dt>
                        <dd className="mt-1 flex items-center gap-2 text-sm leading-relaxed text-foreground"><Trophy className="h-3.5 w-3.5 text-primary/60" />{current.sport_name || '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium leading-relaxed text-muted-foreground">{t('columns.event')}</dt>
                        <dd className="mt-1 flex items-center gap-2 text-sm leading-relaxed text-foreground"><Calendar className="h-3.5 w-3.5 text-primary/60" />{current.event_name || '—'}</dd>
                    </div>
                </dl>
            </div>

            {/* Actions */}
            {allowed.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {allowed.includes('approve') && (
                        <Button className="gap-2 bg-success text-white hover:bg-success/90 border-success" loading={isReviewing} onClick={() => doAction('approve')}>
                            <CheckCircle2 className="h-4 w-4" />
                            {tReview('approve')}
                        </Button>
                    )}
                    {allowed.includes('reject') && (
                        <Button variant="destructive" className="gap-2" disabled={isReviewing} onClick={() => { setReason(''); setReasonAction('reject'); }}>
                            <XCircle className="h-4 w-4" />
                            {tReview('reject')}
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
