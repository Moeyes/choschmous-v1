'use client';

import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { surveySchema } from '../schema/survey.schema';
import type { SurveyFormData } from '../types';

export function useSurveyForm(onSuccess?: () => void) {
    const form = useForm<SurveyFormData>({
        // The schema's input type is nullable (eventId/organizationId start null)
        // while its output is non-null; cast to the output resolver to match.
        resolver: zodResolver(surveySchema) as Resolver<SurveyFormData>,
        mode: 'onBlur',
        defaultValues: {
            eventId: undefined,
            organizationId: undefined,
            sportIds: [],
        },
    });

    const handleSubmit = async (data: SurveyFormData) => {
        try {
            const { surveyRepository } = await import('../adapters');

            if (!data.eventId || !data.organizationId) {
                throw new Error('Missing required fields');
            }

            await surveyRepository.submitSurvey({
                organization_id: data.organizationId,
                event_id: data.eventId,
                sport_ids: data.sportIds,
            });

            onSuccess?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit survey';
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
