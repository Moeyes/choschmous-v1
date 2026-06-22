'use client';

import { useState } from 'react';
import { Layers, Trophy, Calendar } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DataTable, SectionHeader, Badge, PageErrorState } from '@/shared';
import { useTranslations } from 'next-intl';
import { useCategorySubmissions } from '../hooks';
import type { CategorySubmission, CategorySubmissionStatus } from '../types';

const STATUS_OPTIONS: CategorySubmissionStatus[] = [
    'SUBMITTED', 'APPROVED', 'REJECTED', 'FLAGGED', 'REVISION_REQUESTED', 'DRAFT',
];

const STATUS_VARIANT: Record<CategorySubmissionStatus, "info" | "success" | "error" | "warning" | "muted"> = {
    SUBMITTED: "info",
    APPROVED: "success",
    REJECTED: "error",
    FLAGGED: "warning",
    REVISION_REQUESTED: "warning",
    DRAFT: "muted",
};

const badgeVariant = (status: CategorySubmissionStatus) => STATUS_VARIANT[status];

interface CategorySubmissionListProps {
    onSelect: (submission: CategorySubmission) => void;
}

export function CategorySubmissionList({ onSelect }: CategorySubmissionListProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const PAGE_SIZE = 10;
    const t = useTranslations('categoryReview');
    const tStatus = useTranslations('participation.statuses');
    const tCommon = useTranslations('common');

    const [statusFilter, setStatusFilter] = useState<'all' | CategorySubmissionStatus>('all');
    const [search, setSearch] = useState('');

    const { data: response, isLoading, error } = useCategorySubmissions(
        statusFilter === 'all' ? {} : { status: statusFilter },
    );

    const submissions = response?.data ?? [];

    const filtered = submissions.filter((s) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${s.sport_name ?? ''} ${s.event_name ?? ''}`.toLowerCase().includes(q);
    });

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    if (error) return <PageErrorState title={t('failedToLoad')} description={tCommon('connectionError')} />;

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <Input placeholder={t('search')} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }} />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as 'all' | CategorySubmissionStatus); setCurrentPage(0); }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring sm:w-56"
                >
                    <option value="all">{t('allStatuses')}</option>
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{tStatus(s)}</option>
                    ))}
                </select>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <SectionHeader title={t('records.title')} subtitle={t('records.subtitle')} icon={Layers} />
                <DataTable
                    isLoading={isLoading}
                    data={pageRows}
                    rowKey={(item: CategorySubmission) => item.id}
                    onRowClick={(s) => onSelect(s)}
                    columns={[
                        {
                            header: t('columns.sport'),
                            accessor: (s: CategorySubmission) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><Trophy className="h-4.5 w-4.5 text-primary" /></div>
                                    <div>
                                        <p className="text-sm font-medium leading-relaxed text-foreground">{s.sport_name || '—'}</p>
                                        <p className="text-xs leading-relaxed text-muted-foreground">{s.event_name || '—'}</p>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            header: t('columns.event'),
                            accessor: (s: CategorySubmission) => (
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                    <p className="text-sm leading-relaxed text-foreground">{s.event_name || '—'}</p>
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
                                return <Badge variant={badgeVariant(st)}>{tStatus(st)}</Badge>;
                            },
                        },
                        {
                            header: t('columns.submitted'),
                            accessor: (s: CategorySubmission) => <div className="text-sm leading-relaxed text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</div>,
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
