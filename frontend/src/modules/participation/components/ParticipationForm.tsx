'use client';

import { useForm } from 'react-hook-form';
import { useParticipationMutation } from '../hooks';
import { ParticipationPerSportPayload } from '../types';
import { Button } from '@/shared/ui/button';
import { useTranslations } from 'next-intl';

interface ParticipationFormProps { onSuccess?: () => void; }

export function ParticipationForm({ onSuccess }: ParticipationFormProps) {
    const { register, handleSubmit, formState: { errors }, reset } = useForm<ParticipationPerSportPayload>();
    const { create, isCreating } = useParticipationMutation();
    const t = useTranslations('participation');
    const tCommon = useTranslations('common');

    const onSubmit = (data: ParticipationPerSportPayload) => {
        create(data, { onSuccess: () => { reset(); onSuccess?.(); } });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-lg border border-border bg-card p-6">
            <h3 className="text-base font-semibold leading-snug text-foreground">{t('addParticipation')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">{t('fields.enrollId')}</label>
                    <input type="number" {...register('enroll_id', { required: t('fields.required'), valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
                    {errors.enroll_id && <p className="text-sm leading-relaxed text-destructive">{errors.enroll_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">{t('fields.eventId')}</label>
                    <input type="number" {...register('event_id', { required: t('fields.required'), valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
                    {errors.event_id && <p className="text-sm leading-relaxed text-destructive">{errors.event_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">{t('fields.sportId')}</label>
                    <input type="number" {...register('sport_id', { required: t('fields.required'), valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
                    {errors.sport_id && <p className="text-sm leading-relaxed text-destructive">{errors.sport_id.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">{t('fields.categoryId')}</label>
                    <input type="number" {...register('category_id', { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm" />
                </div>
            </div>
            <Button type="submit" loading={isCreating} className="w-full">
                {isCreating ? tCommon('saving') : t('saveParticipation')}
            </Button>
        </form>
    );
}
