'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';
import type { ByNumberFormInput, ByNumberFormData, Event } from '../types';
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from '@/shared';

interface ByNumberEventStepProps {
    form: UseFormReturn<ByNumberFormInput, unknown, ByNumberFormData>;
    events: Event[];
}

export function ByNumberEventStep({ form, events }: ByNumberEventStepProps) {
    const { watch, setValue, trigger } = form;
    const t = useTranslations('bynumber');
    const selectedEventId = watch('eventId');

    if (events.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle icon={CalendarDays} subtitle={t('subtitle')}>
                        {t('headings.event')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                        {t('noEvents')}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const options = events.map((event) => ({
        value: String(event.id),
        label: event.name_kh,
        icon: CalendarDays,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={CalendarDays} subtitle={t('subtitle')}>
                    {t('headings.event')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <RadioCardGroup
                    options={options}
                    value={selectedEventId != null ? String(selectedEventId) : null}
                    onChange={(id) => {
                        setValue('eventId', Number(id));
                        trigger('eventId');
                    }}
                />
            </CardContent>
        </Card>
    );
}
