'use client';

import { useMutation } from '@tanstack/react-query';
import { surveyHttpAdapter } from '../adapters/surveyHttpAdapter';

export function useSurveyMutation() {
    return useMutation({
        mutationFn: (params: { organizationId: number; eventId: number; sportIds: number[] }) =>
            surveyHttpAdapter.submitSurvey({
                organization_id: params.organizationId,
                event_id: params.eventId,
                sport_ids: params.sportIds,
            }),
    });
}
