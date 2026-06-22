'use client';

import { useState } from 'react';
import { Trophy, Building2, Calendar } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DataTable, SectionHeader, Badge, PageErrorState } from '@/shared';
import { useTranslations } from 'next-intl';
import { useParticipations } from '../hooks';
import { groupParticipationsByOrg } from '../types';
import type { ParticipationOrgGroup, ParticipationStatus } from '../types';

// The list endpoint paginates; for the admin org-grouped view we pull a wide
// page and group client-side (mirrors /sport-submissions).
const ADMIN_FETCH_LIMIT = 2000;

const STATUS_OPTIONS: ParticipationStatus[] = [
    'SUBMITTED', 'APPROVED', 'REJECTED', 'FLAGGED', 'REVISION_REQUESTED', 'DRAFT',
];

interface ParticipationOrgListProps {
    onSelectOrg: (group: ParticipationOrgGroup) => void;
}

export function ParticipationOrgList({ onSelectOrg }: ParticipationOrgListProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const PAGE_SIZE = 10;
    const t = useTranslations('participation');
    const tReview = useTranslations('participation.review');
    const tStatus = useTranslations('participation.statuses');
    const tCommon = useTranslations('common');

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ParticipationStatus>('all');

    const { data: response, isLoading, error } = useParticipations({ skip: 0, limit: ADMIN_FETCH_LIMIT });

    const rows = response?.data ?? [];
    // Status filter narrows the underlying rows before grouping.
    const visibleRows = statusFilter === 'all'
        ? rows
        : rows.filter((r) => (r.status ?? 'SUBMITTED') === statusFilter);
    const groups = groupParticipationsByOrg(visibleRows);

    const filtered = groups.filter((g) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${g.org_name ?? ''} ${g.eventNames.join(' ')}`.toLowerCase().includes(q);
    });

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    if (error) return <PageErrorState title={t('failedToLoad')} description={tCommon('connectionError')} />;

    return (
        <div className="space-y-4">
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
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                    <div className="w-full sm:w-72">
                        <Input placeholder={tReview('search')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }} />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as 'all' | ParticipationStatus); setCurrentPage(0); }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring sm:w-56"
                    >
                        <option value="all">{tReview('allStatuses')}</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{tStatus(s)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <SectionHeader title={t('orgRecords.title')} subtitle={t('orgRecords.subtitle')} icon={Building2} />
                <DataTable
                    isLoading={isLoading}
                    data={pageRows}
                    rowKey={(g: ParticipationOrgGroup) => String(g.org_id ?? g.org_name ?? '')}
                    onRowClick={(g) => onSelectOrg(g)}
                    columns={[
                        {
                            header: t('columns.participant'),
                            accessor: (g: ParticipationOrgGroup) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><Building2 className="h-4.5 w-4.5 text-primary" /></div>
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
                            header: t('orgColumns.submissions'),
                            accessor: (g: ParticipationOrgGroup) => (
                                <Badge variant="secondary" size="sm" className="gap-1.5">
                                    <Trophy className="h-3.5 w-3.5" />
                                    {t('nSubmissions', { count: g.total })}
                                </Badge>
                            ),
                        },
                        {
                            header: t('orgColumns.breakdown'),
                            accessor: (g: ParticipationOrgGroup) => (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {g.pending > 0 && <Badge variant="info" size="xs" dot>{g.pending}</Badge>}
                                    {g.approved > 0 && <Badge variant="success" size="xs" dot>{g.approved}</Badge>}
                                    {g.rejected > 0 && <Badge variant="error" size="xs" dot>{g.rejected}</Badge>}
                                    {g.other > 0 && <Badge variant="warning" size="xs" dot>{g.other}</Badge>}
                                </div>
                            ),
                        },
                        {
                            header: t('columns.registered'),
                            accessor: (g: ParticipationOrgGroup) => <div className="text-sm leading-relaxed text-muted-foreground">{new Date(g.latestSubmittedAt).toLocaleDateString()}</div>,
                        },
                    ]}
                />
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {tCommon('showing')} <span className="text-foreground">{currentPage * PAGE_SIZE + 1}</span> {tCommon('to')} <span className="text-foreground">{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}</span> {tCommon('of')} <span className="text-foreground">{totalCount}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>{tCommon('previous')}</Button>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>{tCommon('next')}</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
