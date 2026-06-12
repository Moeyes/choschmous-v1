'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  byCategorySchema,
  type ByCategoryFormInput,
  type ByCategoryFormData,
} from '../schema/bycategory.schema';

export function useByCategoryForm(onSuccess?: () => void) {
  const form = useForm<ByCategoryFormInput, unknown, ByCategoryFormData>({
    resolver: zodResolver(byCategorySchema),
    mode: 'onBlur',
    defaultValues: {
      eventId: undefined,
      sportId: undefined,
      sportName: '',
      categories: [],
      previousCategories: [],
    },
  });

  const handleSubmit = async (data: ByCategoryFormData) => {
    try {
      const { byCategoryHttpAdapter } = await import('../adapters/bycategoryHttpAdapter');

      if (!data.eventId || !data.sportId) {
        throw new Error('Missing required fields');
      }

      await byCategoryHttpAdapter.submitCategories({
        event_id: data.eventId,
        sport_id: data.sportId,
        categories: data.categories.map((c) => ({
          name: c.name,
          gender: c.gender,
        })),
      });

      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit categories';
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
