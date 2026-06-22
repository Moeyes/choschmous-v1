'use client';

import { useState } from 'react';
import { ChevronLeft, Building2, Calendar, Trophy, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable, SectionHeader, Badge } from '@/shared';
import { useTranslations } from 'next-intl';
import { SubmissionReviewModal } from '@/modules/participation';
import { useSportSubmissions, useSportOrgReview } from '../hooks';
import { groupSubmissionsByOrg } from '../types';
import type { SportOrgGroup, SportSubmission, SportSubmissionStatus } from '../types';

interface OrgSubmissionDetailProps {
  group: SportOrgGroup;
  onBack: () => void;
  onSelectSubmission: (submission: SportSubmission) => void;
}

const STATUS_VARIANT: Record<SportSubmissionStatus, 'info' | 'success' | 'error'> = {
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function OrgSubmissionDetail({ group, onBack, onSelectSubmission }: OrgSubmissionDetailProps) {
  const t = useTranslations('sportReview');
  const tStatus = useTranslations('participation.statuses');
  const { reviewOrg, isReviewing } = useSportOrgReview();
  const [reasonAction, setReasonAction] = useState<'reject' | null>(null);
  const [reason, setReason] = useState('');
  const { data } = useSportSubmissions({});
  const all = data?.data ?? [];
  const live = group.organization_id != null ? all.filter((s) => s.organization_id === group.organization_id) : [];
  const current = live.length ? groupSubmissionsByOrg(live)[0] : group;

  const canBulkReview = current.organization_id != null && current.pending > 0;

  const doBulk = (action: 'approve' | 'reject', note?: string) => {
    if (current.organization_id == null) return;
    const event_id = current.eventNames.length === 1 && current.submissions[0]?.events_id != null ? (current.submissions[0].events_id ?? undefined) : undefined;
    reviewOrg(
      { orgId: current.organization_id, payload: { action, note, event_id } },
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

      {/* Org header */}
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
              {t('nSports', { count: current.total })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {current.pending > 0 && (
              <Badge variant="info" size="sm" dot>
                {t('nPending', { count: current.pending })}
              </Badge>
            )}
            {current.approved > 0 && (
              <Badge variant="success" size="sm" dot>
                {t('nApproved', { count: current.approved })}
              </Badge>
            )}
            {current.rejected > 0 && (
              <Badge variant="error" size="sm" dot>
                {t('nRejected', { count: current.rejected })}
              </Badge>
            )}
          </div>
        </div>

        {/* Whole-org bulk actions (only touch pending submissions) */}
        {canBulkReview && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{t('bulkPrompt', { count: current.pending })}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button className="gap-2 bg-success text-white hover:bg-success/90 border-success" loading={isReviewing} onClick={() => doBulk('approve')}>
                <CheckCircle2 className="h-4 w-4" />
                {t('approveAll')}
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={isReviewing}
                onClick={() => {
                  setReason('');
                  setReasonAction('reject');
                }}
              >
                <XCircle className="h-4 w-4" />
                {t('rejectAll')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Per-sport rows — click one to review it individually */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <SectionHeader title={t('orgSports.title')} subtitle={t('orgSports.subtitle')} icon={Trophy} />
        <DataTable
          data={current.submissions}
          rowKey={(s: SportSubmission) => s.id}
          onRowClick={(s) => onSelectSubmission(s)}
          columns={[
            {
              header: t('columns.sport'),
              accessor: (s: SportSubmission) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                    <Trophy className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-foreground">{s.sport_name || '—'}</p>
                </div>
              ),
            },
            {
              header: t('columns.event'),
              accessor: (s: SportSubmission) => (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary/60" />
                  <p className="text-sm leading-relaxed text-foreground">{s.event_name || '—'}</p>
                </div>
              ),
            },
            {
              header: t('columns.status'),
              accessor: (s: SportSubmission) => {
                const st = (s.status ?? 'SUBMITTED') as SportSubmissionStatus;
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
