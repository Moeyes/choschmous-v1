'use client';

import { useState } from 'react';
import { Trophy, Building2, Calendar } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable, SectionHeader, Badge, PageErrorState, FilterToolbar } from '@/shared';
import { useTranslations } from 'next-intl';
import { useSportSubmissions } from '../hooks';
import { groupSubmissionsByOrg } from '../types';
import type { SportOrgGroup, SportSubmissionStatus } from '../types';

const STATUS_OPTIONS: SportSubmissionStatus[] = ['SUBMITTED', 'APPROVED', 'REJECTED'];

interface SportSubmissionListProps {
  onSelectOrg: (group: SportOrgGroup) => void;
}

export function SportSubmissionList({ onSelectOrg }: SportSubmissionListProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;
  const t = useTranslations('sportReview');
  const tStatus = useTranslations('participation.statuses');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SportSubmissionStatus>('all');
  const { data: response, isLoading, error } = useSportSubmissions({});
  const submissions = response?.data ?? [];
  const visibleSubmissions = statusFilter === 'all' ? submissions : submissions.filter((s) => (s.status ?? 'SUBMITTED') === statusFilter);
  const groups = groupSubmissionsByOrg(visibleSubmissions);
  const filtered = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = `${g.org_name ?? ''} ${g.eventNames.join(' ')} ${g.submissions.map((s) => s.sport_name ?? '').join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  if (error) return <PageErrorState title={t('failedToLoad')} description={tCommon('connectionError')} />;

  return (
    <div className="space-y-4">
      {/* Headline: how many organizations have submitted (within the search). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-tight text-foreground">{totalCount}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('orgsSubmitted')}</p>
          </div>
        </div>
        <FilterToolbar
          className="w-full sm:w-auto"
          search={{
            value: search,
            placeholder: t('search'),
            onChange: (value) => {
              setSearch(value);
              setCurrentPage(0);
            },
          }}
          filters={[
            {
              key: 'status',
              value: statusFilter,
              onChange: (value) => {
                setStatusFilter(value as 'all' | SportSubmissionStatus);
                setCurrentPage(0);
              },
              options: [
                { value: 'all', label: t('allStatuses') },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: tStatus(s) })),
              ],
            },
          ]}
          onClear={() => {
            setSearch('');
            setStatusFilter('all');
            setCurrentPage(0);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <SectionHeader title={t('orgRecords.title')} subtitle={t('orgRecords.subtitle')} icon={Building2} />
        <DataTable
          isLoading={isLoading}
          data={pageRows}
          rowKey={(g: SportOrgGroup) => String(g.organization_id ?? g.org_name ?? '')}
          onRowClick={(g) => onSelectOrg(g)}
          columns={[
            {
              header: t('columns.organization'),
              accessor: (g: SportOrgGroup) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                    <Building2 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-relaxed text-foreground">{g.org_name || '—'}</p>
                    <p className="flex items-center gap-1 truncate text-xs leading-relaxed text-muted-foreground">
                      <Calendar className="h-3 w-3 shrink-0 text-primary/60" />
                      {g.eventNames.length > 1 ? t('nEvents', { count: g.eventNames.length }) : g.eventNames[0] || '—'}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              header: t('columns.sports'),
              accessor: (g: SportOrgGroup) => (
                <Badge variant="secondary" size="sm" className="gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  {t('nSports', { count: g.total })}
                </Badge>
              ),
            },
            {
              header: t('columns.breakdown'),
              accessor: (g: SportOrgGroup) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  {g.pending > 0 && (
                    <Badge variant="info" size="xs" dot>
                      {g.pending}
                    </Badge>
                  )}
                  {g.approved > 0 && (
                    <Badge variant="success" size="xs" dot>
                      {g.approved}
                    </Badge>
                  )}
                  {g.rejected > 0 && (
                    <Badge variant="error" size="xs" dot>
                      {g.rejected}
                    </Badge>
                  )}
                </div>
              ),
            },
            {
              header: t('columns.submitted'),
              accessor: (g: SportOrgGroup) => <div className="text-sm leading-relaxed text-muted-foreground">{new Date(g.latestSubmittedAt).toLocaleDateString()}</div>,
            },
          ]}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tCommon('showing')} <span className="text-foreground">{currentPage * PAGE_SIZE + 1}</span> {tCommon('to')}{' '}
              <span className="text-foreground">{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}</span> {tCommon('of')} <span className="text-foreground">{totalCount}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                {tCommon('previous')}
              </Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>
                {tCommon('next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
