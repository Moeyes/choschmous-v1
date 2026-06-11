'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Users, AlertCircle } from 'lucide-react';
import type { ByNumberFormInput, ByNumberFormData, SportRow } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared';
import { cn } from '@/shared/utils/cn';

interface ByNumberSportsTableProps {
    form: UseFormReturn<ByNumberFormInput, unknown, ByNumberFormData>;
}

function CountCell({ value, onChange }: { value: number; onChange: (val: number) => void }) {
    return (
        <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="h-9 w-[72px] rounded-lg border border-border bg-card px-2 text-right text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
    );
}

export function ByNumberSportsTable({ form }: ByNumberSportsTableProps) {
    const { watch, setValue, formState } = form;
    const t = useTranslations('bynumber');
    const sports = watch('sports') || [];

    if (sports.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle icon={Users} subtitle={t('subtitle')}>
                        {t('headings.sports')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border-2 border-dashed border-border p-12 text-center text-sm">
                        <p className="font-semibold text-foreground">{t('noSportsTitle')}</p>
                        <p className="mt-1 text-muted-foreground">{t('noSportsHint')}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const updateSport = (index: number, field: keyof SportRow, val: number) => {
        const updated = [...sports];
        updated[index] = { ...updated[index], [field]: val };
        setValue('sports', updated);
    };

    const totalAthleteM = sports.reduce((s, sp) => s + (sp.athlete_male_count || 0), 0);
    const totalAthleteF = sports.reduce((s, sp) => s + (sp.athlete_female_count || 0), 0);
    const totalLeaderM = sports.reduce((s, sp) => s + (sp.leader_male_count || 0), 0);
    const totalLeaderF = sports.reduce((s, sp) => s + (sp.leader_female_count || 0), 0);
    const grandTotal = totalAthleteM + totalAthleteF + totalLeaderM + totalLeaderF;

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={Users} subtitle={t('subtitle')}>
                    {t('headings.sports')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                                    {t('table.sport')}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                                    {t('table.athleteM')}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                                    {t('table.athleteF')}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                                    {t('table.leaderM')}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                                    {t('table.leaderF')}
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-primary">
                                    {t('table.subtotal')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sports.map((sport, index) => {
                                const subtotal =
                                    (sport.athlete_male_count || 0) +
                                    (sport.athlete_female_count || 0) +
                                    (sport.leader_male_count || 0) +
                                    (sport.leader_female_count || 0);
                                const filled = subtotal > 0;
                                return (
                                    <tr
                                        key={sport.sport_id}
                                        className={cn(
                                            'transition-colors',
                                            filled ? 'bg-primary/5' : 'bg-card',
                                        )}
                                    >
                                        <td className="border-t border-border px-4 py-2.5 font-semibold text-foreground">
                                            {sport.sport_name_kh}
                                        </td>
                                        <td className="border-t border-border px-4 py-2.5 text-right">
                                            <CountCell value={sport.athlete_male_count} onChange={(val) => updateSport(index, 'athlete_male_count', val)} />
                                        </td>
                                        <td className="border-t border-border px-4 py-2.5 text-right">
                                            <CountCell value={sport.athlete_female_count} onChange={(val) => updateSport(index, 'athlete_female_count', val)} />
                                        </td>
                                        <td className="border-t border-border px-4 py-2.5 text-right">
                                            <CountCell value={sport.leader_male_count} onChange={(val) => updateSport(index, 'leader_male_count', val)} />
                                        </td>
                                        <td className="border-t border-border px-4 py-2.5 text-right">
                                            <CountCell value={sport.leader_female_count} onChange={(val) => updateSport(index, 'leader_female_count', val)} />
                                        </td>
                                        <td className="border-t border-border px-4 py-2.5 text-right font-bold text-primary">
                                            {subtotal}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-muted/20">
                                <td className="border-t-2 border-border px-4 py-3 font-bold text-foreground">
                                    {t('table.totals')}
                                </td>
                                <td className="border-t-2 border-border px-4 py-3 text-right font-bold text-foreground">
                                    {totalAthleteM}
                                </td>
                                <td className="border-t-2 border-border px-4 py-3 text-right font-bold text-foreground">
                                    {totalAthleteF}
                                </td>
                                <td className="border-t-2 border-border px-4 py-3 text-right font-bold text-foreground">
                                    {totalLeaderM}
                                </td>
                                <td className="border-t-2 border-border px-4 py-3 text-right font-bold text-foreground">
                                    {totalLeaderF}
                                </td>
                                <td className="border-t-2 border-border px-4 py-3 text-right font-bold text-primary">
                                    {grandTotal}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {formState.errors.sports && (
                    <p className="mt-4 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span>{formState.errors.sports.message}</span>
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
