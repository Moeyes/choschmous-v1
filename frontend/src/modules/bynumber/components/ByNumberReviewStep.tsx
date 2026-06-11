'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CalendarDays, Building2, Users, ClipboardCheck, BarChart3 } from 'lucide-react';
import type { ByNumberFormInput, ByNumberFormData, Event, Organization } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared';
import { cn } from '@/shared/utils/cn';

interface ByNumberReviewStepProps {
    form: UseFormReturn<ByNumberFormInput, unknown, ByNumberFormData>;
    events: Event[];
    organizations: Organization[];
    hideOrganization?: boolean;
}

export function ByNumberReviewStep({ form, events, organizations, hideOrganization = false }: ByNumberReviewStepProps) {
    const { watch } = form;
    const t = useTranslations('bynumber');
    const selectedEventId = watch('eventId');
    const selectedOrgId = watch('organizationId');
    const sports = watch('sports') || [];

    const selectedEvent = events.find((e) => e.id === selectedEventId);
    const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

    const totalAthletes = sports.reduce(
        (sum, s) => sum + s.athlete_male_count + s.athlete_female_count,
        0,
    );
    const totalLeaders = sports.reduce(
        (sum, s) => sum + s.leader_male_count + s.leader_female_count,
        0,
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={ClipboardCheck} subtitle={t('subtitle')}>
                    {t('headings.review')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Card className="overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
                            <CalendarDays className="size-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">{t('review.event')}</span>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-sm font-medium text-foreground">{selectedEvent?.name_kh}</p>
                        </div>
                    </Card>

                    {!hideOrganization && (
                        <Card className="overflow-hidden">
                            <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
                                <Building2 className="size-4 text-primary" />
                                <span className="text-sm font-semibold text-foreground">{t('review.organization')}</span>
                            </div>
                            <div className="px-5 py-4">
                                <p className="text-sm font-medium text-foreground">{selectedOrg?.name_kh}</p>
                            </div>
                        </Card>
                    )}

                    <Card className={cn('overflow-hidden', hideOrganization && 'md:col-span-2')}>
                        <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
                            <Users className="size-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">{t('review.summary')}</span>
                        </div>
                        <div className="flex gap-6 px-5 py-4">
                            <div>
                                <span className="text-xs text-muted-foreground">{t('review.totalAthletes')}</span>
                                <p className="text-xl font-bold text-foreground">{totalAthletes}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">{t('review.totalLeaders')}</span>
                                <p className="text-xl font-bold text-foreground">{totalLeaders}</p>
                            </div>
                            <div className="ml-auto">
                                <span className="text-xs text-muted-foreground">{t('table.totals')}</span>
                                <p className="text-xl font-bold text-primary">{totalAthletes + totalLeaders}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {sports.length > 0 && (
                    <div className="mt-6">
                        <div className="mb-4 flex items-center gap-2">
                            <BarChart3 className="size-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('review.breakdown')}
                            </span>
                            <div className="flex-1 border-t border-border" />
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-border">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-muted/30">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">
                                            {t('table.sport')}
                                        </th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                                            {t('review.athletes')}
                                        </th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                                            {t('review.leaders')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sports.map((sport) => {
                                        const a = sport.athlete_male_count + sport.athlete_female_count;
                                        const l = sport.leader_male_count + sport.leader_female_count;
                                        return (
                                            <tr key={sport.sport_id} className="border-t border-border">
                                                <td className="px-4 py-2.5 font-semibold text-foreground">
                                                    {sport.sport_name_kh}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-foreground">
                                                    {a}
                                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                                        (M:{sport.athlete_male_count} F:{sport.athlete_female_count})
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-foreground">
                                                    {l}
                                                    <span className="ml-1.5 text-xs text-muted-foreground">
                                                        (M:{sport.leader_male_count} F:{sport.leader_female_count})
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
