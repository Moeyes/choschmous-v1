'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/core/api/queryKeys';
import { openSurveyRepository } from '../adapters';
import type {
  OpenSurveyFieldCreateDTO,
  OpenSurveyFieldReorderItem,
  OpenSurveyFieldUpdateDTO,
} from '../schema/openSurveyField.schema';

/**
 * Admin field-builder mutations (create / update / deactivate / reorder).
 *
 * Toasts are declared via `meta.successMessage` / `meta.errorMessage`, which the
 * global MutationCache (`core/api/queryClient`) reads — the same idiom the events
 * admin hooks use. The global cache also strips raw backend errors (no PII leak)
 * and shows a generic translated fallback. Each mutation invalidates every
 * fields query for the event (active-only + include-inactive variants) via the
 * shared `fieldsAll` prefix.
 *
 * Field definitions are admin config, not org answers, so no extra audit/PII
 * handling beyond the standard generic-error path is required here.
 */
export function useMutateOpenSurveyFields(eventId: number) {
  const qc = useQueryClient();
  const t = useTranslations('opensurvey.admin.messages');

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.openSurvey.fieldsAll(eventId) });

  const create = useMutation({
    meta: { successMessage: t('createSuccess'), errorMessage: t('saveError') },
    mutationFn: (dto: OpenSurveyFieldCreateDTO) => openSurveyRepository.createField(eventId, dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    meta: { successMessage: t('updateSuccess'), errorMessage: t('saveError') },
    mutationFn: ({ fieldId, dto }: { fieldId: number; dto: OpenSurveyFieldUpdateDTO }) =>
      openSurveyRepository.updateField(fieldId, dto),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    meta: { successMessage: t('deleteSuccess'), errorMessage: t('saveError') },
    mutationFn: (fieldId: number) => openSurveyRepository.deactivateField(fieldId),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    // Reorder is a frequent micro-action → no success toast (errors still toast
    // via the global cache). Refetch on settle so the persisted order is shown.
    meta: { errorMessage: t('reorderError') },
    mutationFn: (items: OpenSurveyFieldReorderItem[]) => openSurveyRepository.reorderFields(items),
    onSettled: invalidate,
  });

  return { create, update, deactivate, reorder };
}
