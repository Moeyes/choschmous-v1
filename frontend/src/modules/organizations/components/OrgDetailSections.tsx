'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Inbox, Layers, ListChecks, Mars, Venus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DataTable, SectionHeader, Badge } from '@/shared';
import type { ParticipationPerSport } from '@/modules/participation';
import type { SportSubmission } from '@/modules/sportreview';
import type { CategorySubmission } from '@/modules/categoryreview';
import type { OrgRosterTarget } from './OrgRosterModal';

const STATUS_VARIANT: Record<string, 'info' | 'success' | 'error' | 'warning' | 'muted'> = {
    SUBMITTED: 'info',
    APPROVED: 'success',
    REJECTED: 'error',
    FLAGGED: 'warning',
    REVISION_REQUESTED: 'warning',
    DRAFT: 'muted',
};

function StatusBadge({ status }: { status?: string | null }) {
    const t = useTranslations('organizations.detail.statuses');
    const st = (status ?? 'SUBMITTED') as keyof typeof STATUS_VARIANT;
    return <Badge variant={STATUS_VARIANT[st] ?? 'muted'}>{t(st)}</Badge>;
}

/** Total count with a male/female split shown via Mars/Venus icons + colour. */
function CountCell({ male, female }: { male?: number | null; female?: number | null }) {
    const t = useTranslations('organizations.detail');
    const m = male ?? 0;
    const f = female ?? 0;
    return (
        <span className="inline-flex items-center gap-2" aria-label={t('genderCount', { male: m, female: f })}>
            <span className="text-sm font-semibold tabular-nums text-foreground">{m + f}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground" aria-hidden>
                <span className="inline-flex items-center gap-0.5"><Mars className="h-3 w-3 text-blue-600" />{m}</span>
                <span className="inline-flex items-center gap-0.5"><Venus className="h-3 w-3 text-pink-600" />{f}</span>
            </span>
        </span>
    );
}

function SectionEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
    return (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

function SectionCard({ children }: { children: React.ReactNode }) {
    return <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">{children}</section>;
}

interface CountsProps { rows: ParticipationPerSport[]; isLoading: boolean; onSelect: (t: OrgRosterTarget) => void; }

export function OrgSportCountsTable({ rows, isLoading, onSelect }: CountsProps) {
    const t = useTranslations('organizations.detail');
    return (
        <SectionCard>
            <SectionHeader title={t('sections.bySport.title')} subtitle={t('sections.bySport.subtitle')} icon={Users} />
            <DataTable
                data={rows}
                isLoading={isLoading}
                rowKey={(p) => p.id}
                minWidth="min-w-[720px]"
                onRowClick={(p) => {
                    if (p.event_id == null || p.sport_id == null) return;
                    onSelect({ eventId: p.event_id, sportId: p.sport_id, sportName: p.sport_name ?? '—', eventName: p.event_name ?? '—' });
                }}
                emptyState={<SectionEmpty icon={Users} text={t('sections.bySport.empty')} />}
                columns={[
                    { header: t('columns.sport'), accessor: (p: ParticipationPerSport) => <span className="font-semibold text-foreground">{p.sport_name ?? '—'}</span> },
                    { header: t('columns.event'), hideOnMobile: true, accessor: (p: ParticipationPerSport) => <span className="text-sm text-muted-foreground">{p.event_name ?? '—'}</span> },
                    { header: t('columns.athletes'), align: 'center', accessor: (p: ParticipationPerSport) => <CountCell male={p.athlete_male_count} female={p.athlete_female_count} /> },
                    { header: t('columns.leaders'), align: 'center', accessor: (p: ParticipationPerSport) => <CountCell male={p.leader_male_count} female={p.leader_female_count} /> },
                    { header: t('columns.status'), accessor: (p: ParticipationPerSport) => <StatusBadge status={p.status} /> },
                    { header: '', align: 'right', className: 'w-10', hideOnMobile: true, accessor: () => <ChevronRight className="h-4 w-4 text-muted-foreground" /> },
                ]}
            />
        </SectionCard>
    );
}

export function OrgSurveyStatusTable({ rows, isLoading }: { rows: SportSubmission[]; isLoading: boolean }) {
    const t = useTranslations('organizations.detail');
    return (
        <SectionCard>
            <SectionHeader title={t('sections.surveyStatus.title')} subtitle={t('sections.surveyStatus.subtitle')} icon={ListChecks} />
            <DataTable
                data={rows}
                isLoading={isLoading}
                rowKey={(s) => s.id}
                minWidth="min-w-[560px]"
                emptyState={<SectionEmpty icon={Inbox} text={t('sections.surveyStatus.empty')} />}
                columns={[
                    { header: t('columns.sport'), accessor: (s: SportSubmission) => <span className="font-semibold text-foreground">{s.sport_name ?? '—'}</span> },
                    { header: t('columns.event'), hideOnMobile: true, accessor: (s: SportSubmission) => <span className="text-sm text-muted-foreground">{s.event_name ?? '—'}</span> },
                    { header: t('columns.status'), accessor: (s: SportSubmission) => <StatusBadge status={s.status} /> },
                ]}
            />
        </SectionCard>
    );
}

export function OrgCategoryTable({ rows, isLoading }: { rows: CategorySubmission[]; isLoading: boolean }) {
    const t = useTranslations('organizations.detail');
    return (
        <SectionCard>
            <SectionHeader title={t('sections.category.title')} subtitle={t('sections.category.subtitle')} icon={Layers} />
            <DataTable
                data={rows}
                isLoading={isLoading}
                rowKey={(c) => c.id}
                minWidth="min-w-[560px]"
                emptyState={<SectionEmpty icon={Layers} text={t('sections.category.empty')} />}
                columns={[
                    { header: t('columns.sport'), accessor: (c: CategorySubmission) => <span className="font-semibold text-foreground">{c.sport_name ?? '—'}</span> },
                    { header: t('columns.event'), hideOnMobile: true, accessor: (c: CategorySubmission) => <span className="text-sm text-muted-foreground">{c.event_name ?? '—'}</span> },
                    { header: t('columns.categories'), align: 'center', accessor: (c: CategorySubmission) => <span className="text-sm font-medium text-foreground">{c.category_count}</span> },
                    { header: t('columns.status'), accessor: (c: CategorySubmission) => <StatusBadge status={c.status} /> },
                ]}
            />
        </SectionCard>
    );
}
