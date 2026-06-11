'use client';

import { useState } from 'react';
import { useParticipations, useParticipationMutation } from '../hooks';
import { useAuth, usePermissions, CAPABILITIES } from '@/core/auth';
import { Trash2, Trophy, Building2, User, Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DataTable, SectionHeader, Badge, PageErrorState, useConfirm } from '@/shared';
import { useTranslations } from 'next-intl';
import type { ParticipationPerSport, ParticipationStatus } from '../types';

const STATUS_OPTIONS: ParticipationStatus[] = [
    'SUBMITTED', 'APPROVED', 'REJECTED', 'FLAGGED', 'REVISION_REQUESTED', 'DRAFT',
];

const badgeVariant = (status: ParticipationStatus) =>
    status.toLowerCase() as 'submitted' | 'approved' | 'rejected' | 'flagged' | 'revision_requested' | 'draft';

interface ParticipationListProps {
    onSelect?: (submission: ParticipationPerSport) => void;
}

export function ParticipationList({ onSelect }: ParticipationListProps) {
    const { user } = useAuth();
    const { can } = usePermissions();
    const [currentPage, setCurrentPage] = useState(0);
    const PAGE_SIZE = 10;
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const organization_id = isAdmin ? undefined : (user?.org_id || undefined);
    const t = useTranslations('participation');
    const tStatus = useTranslations('participation.statuses');
    const tReview = useTranslations('participation.review');
    const tCommon = useTranslations('common');
    const confirm = useConfirm();

    const [statusFilter, setStatusFilter] = useState<'all' | ParticipationStatus>('all');
    const [search, setSearch] = useState('');

    const { data: response, isLoading, error } = useParticipations({ organization_id, skip: currentPage * PAGE_SIZE, limit: PAGE_SIZE });
    const { remove, isRemoving } = useParticipationMutation();

    const participations = response?.data || [];
    const totalCount = response?.count || 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Client-side filtering of the loaded page (the list endpoint has no status/search params yet).
    const filtered = participations.filter((p) => {
        const status = (p.status ?? 'SUBMITTED') as ParticipationStatus;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        const q = search.trim().toLowerCase();
        const matchesSearch = !q || `${p.org_name ?? ''} ${p.event_name ?? ''}`.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const handleDelete = async (id: number) => { if (await confirm({ message: t('deleteConfirm') })) remove(id); };

    if (error) return (
        <PageErrorState title={t('failedToLoad')} description={tCommon('connectionError')} />
    );

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                    <Input
                        placeholder={tReview('search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | ParticipationStatus)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring sm:w-56"
                >
                    <option value="all">{tReview('allStatuses')}</option>
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{tStatus(s)}</option>
                    ))}
                </select>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <SectionHeader title={t('records.title')} subtitle={t('records.subtitle')} icon={Trophy}
                    action={<Button size="sm" className="gap-2"><Plus className="h-4 w-4" />{t('addRecord')}</Button>}
                />
                <DataTable
                    isLoading={isLoading}
                    data={filtered}
                    onRowClick={onSelect ? (p) => onSelect(p) : undefined}
                    columns={[
                        {
                            header: t('columns.participant'),
                            accessor: (p) => (
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><User className="h-4.5 w-4.5 text-primary" /></div>
                                    <div>
                                        <p className="text-sm font-medium leading-relaxed text-foreground">{p.org_name || p.participant_name || '—'}</p>
                                        <p className="text-xs leading-relaxed text-muted-foreground">{p.event_name || 'Organization'}</p>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            header: t('columns.event'),
                            accessor: (p) => (
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-primary/60" />
                                    <p className="text-sm leading-relaxed text-foreground">{p.event_name || '—'}</p>
                                </div>
                            ),
                        },
                        {
                            header: tReview('filterStatus'),
                            accessor: (p) => {
                                const s = (p.status ?? 'SUBMITTED') as ParticipationStatus;
                                return <Badge variant={badgeVariant(s)}>{tStatus(s)}</Badge>;
                            },
                        },
                        {
                            header: t('columns.registered'),
                            accessor: (p) => <div className="text-sm leading-relaxed text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>,
                        },
                        ...(isAdmin ? [{
                            header: tCommon('actions'), align: 'right' as const,
                            accessor: (p: ParticipationPerSport) => (
                                <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} disabled={isRemoving} className="text-muted-foreground hover:bg-destructive/5 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            ),
                        }] : []),
                    ]} />
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {tCommon('showing')} <span className="text-foreground">{currentPage * PAGE_SIZE + 1}</span> {tCommon('to')} <span className="text-foreground">{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}</span> {tCommon('of')} <span className="text-foreground">{totalCount}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>{tCommon('previous')}</Button>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>{tCommon('next')}</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
