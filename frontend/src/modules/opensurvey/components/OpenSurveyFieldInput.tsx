'use client';

import type { Control, Path } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { TextInputField } from '@/shared';
import { FormField } from '@/shared/form/FormField';
import { Input } from '@/shared/ui/input';
import {
  choiceControlFor,
  extractFieldOptions,
  htmlInputType,
  type OpenSurveyField,
  type OpenSurveyFormValues,
} from '../schema/opensurvey.schema';
import {
  OpenSurveyCheckboxField,
  OpenSurveyRadioField,
  OpenSurveySelectField,
} from './OpenSurveyChoiceField';

interface OpenSurveyFieldInputProps {
  field: OpenSurveyField;
  control: Control<OpenSurveyFormValues>;
  label: string;
  error?: string;
  readOnly?: boolean;
  value?: string;
}

/**
 * Renders ONE survey field, driven by field_type + options:
 *  - read-only mode (phase closed)        → disabled display of the saved value
 *  - choice type (select/dropdown/radio/checkbox) WITH options → the matching
 *    control (dropdown / radio group / checkbox group)
 *  - everything else                      → TextInputField (text / number)
 *
 * Prefill applies throughout: an answered field shows its saved value, a null
 * value shows empty/unselected.
 */
export function OpenSurveyFieldInput({
  field,
  control,
  label,
  error,
  readOnly = false,
  value = '',
}: OpenSurveyFieldInputProps) {
  const t = useTranslations('opensurvey');
  const name = `responses.${field.field_id}` as Path<OpenSurveyFormValues>;
  const required = field.required;
  const fieldId = `open-survey-field-${field.field_id}`;

  if (readOnly) {
    return (
      <FormField label={label} required={required} htmlFor={fieldId}>
        <Input id={fieldId} value={value} readOnly disabled />
      </FormField>
    );
  }

  const control_ = choiceControlFor(field.field_type);
  const options = extractFieldOptions(field);

  if (control_ && options) {
    const shared = { control, name, label, required, options, error, htmlFor: fieldId };
    if (control_ === 'select') {
      return <OpenSurveySelectField {...shared} placeholder={t('choicePlaceholder')} />;
    }
    if (control_ === 'radio') {
      return <OpenSurveyRadioField {...shared} />;
    }
    return <OpenSurveyCheckboxField {...shared} />;
  }

  return (
    <TextInputField
      control={control}
      name={name}
      label={label}
      required={required}
      type={htmlInputType(field.field_type)}
      error={error}
      htmlFor={fieldId}
    />
  );
}
