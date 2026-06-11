'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    byNumberSchema,
    type ByNumberFormInput,
    type ByNumberFormData,
} from '../schema/bynumber.schema';

export function useByNumberForm(onSuccess?: () => void) {
    const form = useForm<ByNumberFormInput, unknown, ByNumberFormData>({
        resolver: zodResolver(byNumberSchema),
        mode: 'onBlur',
        defaultValues: {
            eventId: undefined,
            organizationId: undefined,
            sports: [],
            eventName: '',
            organizationName: '',
            sportSelections: [],
        },
    });

    const handleSubmit = async (data: ByNumberFormData) => {
        try {
            const { bynumberRepository } = await import('../adapters');

            if (!data.eventId || !data.organizationId) {
                throw new Error('Missing required fields');
            }

            await bynumberRepository.submitByNumber({
                organization_id: data.organizationId,
                event_id: data.eventId,
                sports: data.sports.map((sport) => ({
                    sport_id: sport.sport_id,
                    athlete_male_count: sport.athlete_male_count,
                    athlete_female_count: sport.athlete_female_count,
                    leader_male_count: sport.leader_male_count,
                    leader_female_count: sport.leader_female_count,
                })),
            });

            onSuccess?.();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to submit registration';
            form.setError('root', { message });
        }
    };

    return {
        form,
        onSubmit: handleSubmit,
        isPending: form.formState.isSubmitting,
        serverError: form.formState.errors.root?.message || null,
    };
}
