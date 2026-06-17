'use client';

import { useState } from 'react';
import { ChevronLeft, Trophy, Calendar, CheckCircle2, XCircle, Flag } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/Badge';
import { useTranslations } from 'next-intl';
// Reuse the by-number reference's presentational review pieces (do not modify
// them) so the by-category queue matches /participation exactly.
import { StatusTimeline, SubmissionReviewModal } from '@/modules/participation';
import { useCategorySubmission, useCategorySubmissionReview } from '../hooks';
import type {
    CategorySubmission,
    CategorySubmissionWithCategories as CategorySubmissionDetailType,
    CategorySubmissionStatus,
    CategoryReviewAction,
} from '../types';

interface CategorySubmissionDetailProps {
    submission: CategorySubmission;
    onBack: () => void;
}

// Mirror of the by-category backend FSM (UX only — the server enforces it).
const ALLOWED: Record<string, ('approve' | 'reject' | 'flag')[]> = {
    SUBMITTED: ['approve', 'reject', 'flag'],
    FLAGGED: ['approve', 'reject'],
    REVISION_REQUESTED: ['approve'],
    DRAFT: [],
    APPROVED: [],
    REJECTED: [],
};

const badgeVariant = (status: CategorySubmissionStatus) =>
    status.toLowerCase() as 'submitted' | 'approved' | 'rejected' | 'flagged' | 'revision_requested' | 'draft';

export function CategorySubmissionDetail({ submission, onBack }: CategorySubmissionDetailProps) {
    const t = useTranslations('categoryReview');
    const tReview = useTranslations('participation.review');
    const tStatus = useTranslations('participation.statuses');
    const { data: detail } = useCategorySubmission(submission.id);
    const { review, isReviewing } = useCategorySubmissionReview();
    const [reviewed, setReviewed] = useState<CategorySubmissionDetailType | null>(null);
    const [reasonAction, setReasonAction] = useState<'reject' | 'flag' | null>(null);
    const [reason, setReason] = useState('');

    // Header/status come from the freshest source; the categories list comes
    // from whichever full detail we have (review response or the detail fetch).
    const current: CategorySubmission = reviewed ?? detail ?? submission;
    const categories = (reviewed ?? detail)?.categories ?? [];
    const status = (current.status ?? 'SUBMITTED') as CategorySubmissionStatus;
    const allowed = ALLOWED[status] ?? [];

    const doAction = (action: CategoryReviewAction, note?: string) => {
        review(
            { id: current.id, payload: { action, note } },
            {
                onSuccess: (data) => {
                    setReviewed(data);
                    setReasonAction(null);
                    setReason('');
                },
            },
        );
    };

    const genderLabel = (g?: string | null) => {
        if (g === 'MALE' || g === 'FEMALE' || g === 'MIXED') return t(`gender.${g}`);
        return '—';
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
                            <Trophy className="h-4 w-4 text-primary" />
                            <h1 className="text-xl font-semibold leading-snug text-foreground">{current.sport_name || '—'}</h1>
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

            {/* Submitted data — the declared categories (by-category's own shape) */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold leading-snug text-foreground">
                    {t('declaredCategories')} <span className="text-muted-foreground">({categories.length})</span>
                </h2>
                {categories.length === 0 ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{t('noCategories')}</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full min-w-[320px] border-collapse text-sm">
                            <thead>
                                <tr className="bg-muted text-xs font-medium leading-relaxed text-muted-foreground">
                                    <th className="px-4 py-3 text-left">{t('columns.category')}</th>
                                    <th className="px-4 py-3 text-left">{t('columns.gender')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                                {categories.map((c) => (
                                    <tr key={c.id}>
                                        <td className="px-4 py-3 font-medium leading-relaxed text-foreground">{c.category}</td>
                                        <td className="px-4 py-3 leading-relaxed text-muted-foreground">{genderLabel(c.gender)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                    {allowed.includes('flag') && (
                        <Button className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90 border-warning" disabled={isReviewing} onClick={() => { setReason(''); setReasonAction('flag'); }}>
                            <Flag className="h-4 w-4" />
                            {tReview('flag')}
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
