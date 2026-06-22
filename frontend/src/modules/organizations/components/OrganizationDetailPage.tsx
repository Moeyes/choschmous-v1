'use client';

import { useMemo, useState } from 'react';
import { Building2, CalendarDays, Users, UserCheck, Trophy, ListChecks, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    PageShell, DetailHeader, StatCard, Badge,
    PageLoadingState, PageNotFound,
} from '@/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ToggleGroup } from '@/shared/ui/toggle-group';
import { useParticipations } from '@/modules/participation';
import { useSportSubmissions } from '@/modules/sportreview';
import { useCategorySubmissions } from '@/modules/categoryreview';
import type { ParticipationPerSport } from '@/modules/participation';
import { useOrganization } from '../hooks';
import { OrgRosterModal, type OrgRosterTarget } from './OrgRosterModal';
import { OrgSportCountsTable, OrgSurveyStatusTable, OrgCategoryTable } from './OrgDetailSections';

const ALL = 'all';
const FETCH_LIMIT = 2000;
type Tab = 'sport' | 'survey' | 'category';

const sum = (p: ParticipationPerSport, k: keyof ParticipationPerSport) => (p[k] as number | null | undefined) ?? 0;

interface OrganizationDetailPageProps {
    orgId: number;
}

export function OrganizationDetailPage({ orgId }: OrganizationDetailPageProps) {
    const t = useTranslations('organizations.detail');
    const tTypes = useTranslations('organizations.types');

    const { data: org, isLoading: orgLoading } = useOrganization(orgId);
    const { data: partRes, isLoading: partLoading } = useParticipations({ organization_id: orgId, limit: FETCH_LIMIT });
    const { data: sportRes, isLoading: sportLoading } = useSportSubmissions({ organization_id: orgId });
    const { data: catRes, isLoading: catLoading } = useCategorySubmissions({ limit: FETCH_LIMIT });

    const [eventId, setEventId] = useState<string>(ALL);
    const [tab, setTab] = useState<Tab>('sport');
    const [roster, setRoster] = useState<OrgRosterTarget | null>(null);

    const participations = useMemo(() => partRes?.data ?? [], [partRes]);
    const sportSubmissions = useMemo(() => sportRes?.data ?? [], [sportRes]);

    // Event filter options come from the org's own data, so only events the org
    // actually appears in are ever selectable.
    const eventOptions = useMemo(() => {
        const map = new Map<number, string>();
        for (const p of participations) if (p.event_id != null) map.set(p.event_id, p.event_name ?? `#${p.event_id}`);
        for (const s of sportSubmissions) if (s.events_id != null) map.set(s.events_id, s.event_name ?? `#${s.events_id}`);
        return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [participations, sportSubmissions]);

    const eventFilter = eventId === ALL ? null : Number(eventId);

    const filteredParts = useMemo(
        () => participations.filter((p) => eventFilter == null || p.event_id === eventFilter),
        [participations, eventFilter],
    );
    const filteredSports = useMemo(
        () => sportSubmissions.filter((s) => eventFilter == null || s.events_id === eventFilter),
        [sportSubmissions, eventFilter],
    );

    // Category submissions are event+sport scoped (no org column), so we surface
    // only the ones whose (event, sport) pair this org actually participates in.
    const orgEventSportKeys = useMemo(() => {
        const set = new Set<string>();
        for (const p of participations) if (p.event_id != null && p.sport_id != null) set.add(`${p.event_id}:${p.sport_id}`);
        for (const s of sportSubmissions) if (s.events_id != null && s.sports_id != null) set.add(`${s.events_id}:${s.sports_id}`);
        return set;
    }, [participations, sportSubmissions]);

    const filteredCategories = useMemo(
        () => (catRes?.data ?? []).filter(
            (c) => c.events_id != null && c.sports_id != null
                && orgEventSportKeys.has(`${c.events_id}:${c.sports_id}`)
                && (eventFilter == null || c.events_id === eventFilter),
        ),
        [catRes, orgEventSportKeys, eventFilter],
    );

    const totals = useMemo(() => {
        const acc = filteredParts.reduce(
            (a, p) => {
                a.am += sum(p, 'athlete_male_count'); a.af += sum(p, 'athlete_female_count');
                a.lm += sum(p, 'leader_male_count'); a.lf += sum(p, 'leader_female_count');
                const st = p.status ?? 'SUBMITTED';
                if (st === 'SUBMITTED') a.pending += 1; else if (st === 'APPROVED') a.approved += 1; else if (st === 'REJECTED') a.rejected += 1;
                if (p.sport_id != null) a.sports.add(p.sport_id);
                return a;
            },
            { am: 0, af: 0, lm: 0, lf: 0, pending: 0, approved: 0, rejected: 0, sports: new Set<number>() },
        );
        const athletes = acc.am + acc.af;
        const leaders = acc.lm + acc.lf;
        return {
            events: new Set(participations.map((p) => p.event_id).filter((x) => x != null)).size,
            sports: acc.sports.size,
            athletes, leaders, participants: athletes + leaders,
            am: acc.am, af: acc.af, lm: acc.lm, lf: acc.lf,
            pending: acc.pending, approved: acc.approved, rejected: acc.rejected,
        };
    }, [participations, filteredParts]);

    if (orgLoading) return <PageLoadingState />;
    if (!org) return <PageNotFound title={t('notFound')} />;

    const tabCount: Record<Tab, number> = { sport: filteredParts.length, survey: filteredSports.length, category: filteredCategories.length };
    const tabOptions = [
        { value: 'sport', label: `${t('tabs.bySport')} · ${tabCount.sport}`, icon: Users },
        { value: 'survey', label: `${t('tabs.surveyStatus')} · ${tabCount.survey}`, icon: ListChecks },
        { value: 'category', label: `${t('tabs.category')} · ${tabCount.category}`, icon: Layers },
    ];

    return (
        <PageShell size="wide">
            <div className="space-y-6">
                <DetailHeader
                    backHref="/organizations"
                    backLabel={t('backToOrgs')}
                    eyebrow={tTypes(org.type)}
                    eyebrowIcon={Building2}
                    title={org.name_kh}
                    description={org.name_en ?? undefined}
                    meta={
                        <>
                            <Badge variant="secondary" size="sm" className="gap-1.5"><Users className="h-3 w-3" />{t('participantsTotal', { count: totals.participants })}</Badge>
                            {totals.pending > 0 && <Badge variant="info" size="sm" dot>{t('nPending', { count: totals.pending })}</Badge>}
                            {totals.approved > 0 && <Badge variant="success" size="sm" dot>{t('nApproved', { count: totals.approved })}</Badge>}
                            {totals.rejected > 0 && <Badge variant="error" size="sm" dot>{t('nRejected', { count: totals.rejected })}</Badge>}
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard label={t('stats.events')} value={totals.events} icon={CalendarDays} color="blue" />
                    <StatCard label={t('stats.sports')} value={totals.sports} icon={Trophy} color="amber" />
                    <StatCard label={t('stats.athletes')} value={totals.athletes} icon={Users} color="emerald" description={t('genderSplit', { male: totals.am, female: totals.af })} />
                    <StatCard label={t('stats.leaders')} value={totals.leaders} icon={UserCheck} color="purple" description={t('genderSplit', { male: totals.lm, female: totals.lf })} />
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <ToggleGroup options={tabOptions} value={tab} onChange={(v) => setTab(v as Tab)} className="flex-wrap" />
                    <div className="flex items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:inline">{t('showingCount', { count: tabCount[tab] })}</span>
                        <Select value={eventId} onValueChange={(v) => setEventId(v || ALL)}>
                            <SelectTrigger className="w-full sm:w-64">
                                <SelectValue placeholder={t('allEvents')}>
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                        {eventId === ALL ? t('allEvents') : eventOptions.find((e) => String(e.id) === eventId)?.name}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t('allEvents')}</SelectItem>
                                {eventOptions.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {tab === 'sport' && <OrgSportCountsTable rows={filteredParts} isLoading={partLoading} onSelect={setRoster} />}
                {tab === 'survey' && <OrgSurveyStatusTable rows={filteredSports} isLoading={sportLoading} />}
                {tab === 'category' && <OrgCategoryTable rows={filteredCategories} isLoading={catLoading} />}
            </div>

            {roster && <OrgRosterModal orgId={orgId} target={roster} onClose={() => setRoster(null)} />}
        </PageShell>
    );
}
