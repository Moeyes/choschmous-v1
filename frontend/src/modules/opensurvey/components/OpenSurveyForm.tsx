'use client';

import { useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { AlertCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/shared';
import { useMutateOpenSurvey, isPhaseClosedError } from '../hooks/useMutateOpenSurvey';
import {
  buildOpenSurveyFormSchema,
  fieldsToDefaults,
  formValuesToPayload,
  resolveFieldLabel,
  type OpenSurveyField,
  type OpenSurveyFormValues,
} from '../schema/opensurvey.schema';
import { OpenSurveyFieldInput } from './OpenSurveyFieldInput';

interface OpenSurveyFormProps {
  eventId: number;
  organizationId?: number;
  fields: OpenSurveyField[];
  onSuccess: () => void;
}

export function OpenSurveyForm({ eventId, organizationId, fields, onSuccess }: OpenSurveyFormProps) {
  const t = useTranslations('opensurvey');
  const validationMessages = useMemo(
    () => ({
      required: t('validation.required'),
      selectOne: t('validation.selectOne'),
      selectAtLeastOne: t('validation.selectAtLeastOne'),
    }),
    [t],
  );
  const mutation = useMutateOpenSurvey();

  // The fill view is readable while the phase is closed, but POST is gated.
  // The public events response does NOT expose the open-survey phase flag, so
  // the only authoritative "closed" signal is a 403 on submit — at which point
  // we render every field read-only and disable the submit button.
  const phaseClosed = isPhaseClosedError(mutation.error);

  const schema = useMemo(
    () => buildOpenSurveyFormSchema(fields, validationMessages),
    [fields, validationMessages],
  );
  const defaults = useMemo(() => fieldsToDefaults(fields), [fields]);

  const form = useForm<OpenSurveyFormValues>({
    resolver: zodResolver(schema) as Resolver<OpenSurveyFormValues>,
    mode: 'onBlur',
    values: defaults,
  });

  const responseErrors = form.formState.errors.responses as unknown as
    | Record<string, { message?: string } | undefined>
    | undefined;

  const onSubmit = (values: OpenSurveyFormValues) => {
    mutation.mutate(formValuesToPayload(values, fields, eventId, organizationId), {
      onSuccess: () => onSuccess(),
    });
  };

  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        {t('noFields')}
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {phaseClosed && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{t('closedNotice')}</p>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        {fields.map((field) => (
          <OpenSurveyFieldInput
            key={field.field_id}
            field={field}
            control={form.control}
            label={resolveFieldLabel(field)}
            error={responseErrors?.[String(field.field_id)]?.message}
            readOnly={phaseClosed}
            value={field.value ?? ''}
          />
        ))}
      </div>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={phaseClosed || mutation.isPending}
          className="gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {mutation.isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
