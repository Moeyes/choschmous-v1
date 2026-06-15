'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { queryKeys } from '@/core/api/queryKeys';
import { openSurveyRepository } from '../adapters';
import type { OpenSurveySubmitPayload } from '../schema/opensurvey.schema';

/**
 * The open-survey POST is phase-gated server-side; a closed phase returns 403.
 * Since the public events response does not expose the open-survey phase flag,
 * a 403 on submit is the only authoritative "closed" signal the client gets.
 */
export function isPhaseClosedError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 403;
}

export function useMutateOpenSurvey() {
  const qc = useQueryClient();
  const t = useTranslations('opensurvey');

  return useMutation({
    mutationFn: (payload: OpenSurveySubmitPayload) => openSurveyRepository.submitResponses(payload),
    onSuccess: (_data, payload) => {
      toast.success(t('messages.submitSuccess'));
      qc.invalidateQueries({
        queryKey: queryKeys.openSurvey.fillView(payload.eventId, payload.organizationId),
      });
    },
    onError: (error) => {
      // Generic, PII-free messages only — never surface the raw server detail.
      toast.error(isPhaseClosedError(error) ? t('messages.phaseClosed') : t('messages.submitError'));
    },
  });
}
