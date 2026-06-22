'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ModalV2 } from '@/shared/ui/ModalV2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useUpdateSportConfig } from '../hooks';
import type { EventSportPublic } from '../schema/events.schema';
import type { SportMode } from '../types';

interface EventSportConfigDialogProps {
    eventId: number;
    sport: EventSportPublic;
    isOpen: boolean;
    onClose: () => void;
}

const MODES: SportMode[] = ['individual', 'team', 'both'];

export function EventSportConfigDialog({ eventId, sport, isOpen, onClose }: EventSportConfigDialogProps) {
    const t = useTranslations('events.sports.config');
    const tCommon = useTranslations('common');
    const { mutate, isPending } = useUpdateSportConfig(eventId);

    const [mode, setMode] = useState<SportMode>((sport.mode as SportMode) ?? 'individual');
    const [teamMin, setTeamMin] = useState(sport.team_size_min?.toString() ?? '');
    const [teamMax, setTeamMax] = useState(sport.team_size_max?.toString() ?? '');
    const [quotaAthletes, setQuotaAthletes] = useState(sport.quota_athletes_per_org?.toString() ?? '');
    const [quotaTeams, setQuotaTeams] = useState(sport.quota_teams_per_org?.toString() ?? '');

    const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
    const isTeam = mode === 'team' || mode === 'both';

    const handleSave = () => {
        mutate(
            {
                id: sport.id,
                config: {
                    mode,
                    team_size_min: isTeam ? toNum(teamMin) : null,
                    team_size_max: isTeam ? toNum(teamMax) : null,
                    quota_athletes_per_org: toNum(quotaAthletes),
                    quota_teams_per_org: isTeam ? toNum(quotaTeams) : null,
                },
            },
            { onSuccess: onClose },
        );
    };

    const inputClass =
        'w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary';

    return (
        <ModalV2
            isOpen={isOpen}
            onClose={onClose}
            title={`${t('title')} — ${sport.name_kh}`}
            size="sm"
            cancelText={tCommon('cancel')}
            confirmText={isPending ? tCommon('saving') : tCommon('save')}
            confirmLoading={isPending}
            onConfirm={handleSave}
        >
            <div className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">{t('mode')}</label>
                    <Select value={mode} onValueChange={(v) => setMode((v as SportMode) || 'individual')}>
                        <SelectTrigger className="w-full">
                            <SelectValue>{t(`modes.${mode}`)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {MODES.map((m) => (
                                <SelectItem key={m} value={m}>{t(`modes.${m}`)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {isTeam && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">{t('teamSizeMin')}</label>
                            <input type="number" min={0} value={teamMin}
                                onChange={(e) => setTeamMin(e.target.value)} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">{t('teamSizeMax')}</label>
                            <input type="number" min={0} value={teamMax}
                                onChange={(e) => setTeamMax(e.target.value)} className={inputClass} />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-foreground">{t('quotaAthletes')}</label>
                        <input type="number" min={0} value={quotaAthletes}
                            onChange={(e) => setQuotaAthletes(e.target.value)} className={inputClass}
                            placeholder={t('unlimited')} />
                    </div>
                    {isTeam && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">{t('quotaTeams')}</label>
                            <input type="number" min={0} value={quotaTeams}
                                onChange={(e) => setQuotaTeams(e.target.value)} className={inputClass}
                                placeholder={t('unlimited')} />
                        </div>
                    )}
                </div>
            </div>
        </ModalV2>
    );
}
