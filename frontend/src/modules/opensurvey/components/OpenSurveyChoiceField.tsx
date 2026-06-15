'use client';

import { Controller, type Control, type Path } from 'react-hook-form';
import { FormField } from '@/shared/form/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import {
  joinCheckboxSelection,
  parseCheckboxSelection,
  type OpenSurveyChoiceOption,
  type OpenSurveyFormValues,
} from '../schema/opensurvey.schema';

/**
 * Module-local RHF choice controls for the open-survey fill form.
 *
 * All three keep the field value a plain string so it round-trips through the
 * single-string storage model (response `value: str`). They deliberately do NOT
 * reuse the shared `SelectField`, whose onValueChange coerces numeric-looking
 * option values to `number` — which would break the `Record<string, string>`
 * form contract for option keys like "2024".
 */
interface OpenSurveyChoiceFieldProps {
  control: Control<OpenSurveyFormValues>;
  name: Path<OpenSurveyFormValues>;
  label: string;
  required: boolean;
  options: OpenSurveyChoiceOption[];
  error?: string;
  htmlFor: string;
}

// Normalise an RHF field value (possibly undefined before registration) to string.
function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// select / dropdown → single-value dropdown.
export function OpenSurveySelectField({
  control,
  name,
  label,
  required,
  options,
  error,
  htmlFor,
  placeholder,
}: OpenSurveyChoiceFieldProps & { placeholder: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField label={label} required={required} error={error} htmlFor={htmlFor}>
          <Select value={asString(field.value)} onValueChange={field.onChange}>
            <SelectTrigger id={htmlFor} onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
    />
  );
}

// radio → single-value group.
export function OpenSurveyRadioField({
  control,
  name,
  label,
  required,
  options,
  error,
  htmlFor,
}: OpenSurveyChoiceFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const current = asString(field.value);
        return (
          <FormField label={label} required={required} error={error} htmlFor={`${htmlFor}-0`}>
            <div role="radiogroup" aria-label={label} className="space-y-2">
              {options.map((option, index) => {
                const optionId = `${htmlFor}-${index}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={optionId}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="radio"
                      id={optionId}
                      name={String(name)}
                      value={option.value}
                      checked={current === option.value}
                      onChange={() => field.onChange(option.value)}
                      onBlur={field.onBlur}
                      className="size-4 accent-primary"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </FormField>
        );
      }}
    />
  );
}

// checkbox → multi-value group, encoded as a comma-joined string.
export function OpenSurveyCheckboxField({
  control,
  name,
  label,
  required,
  options,
  error,
  htmlFor,
}: OpenSurveyChoiceFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selected = new Set(parseCheckboxSelection(asString(field.value)));
        const toggle = (value: string, checked: boolean) => {
          if (checked) selected.add(value);
          else selected.delete(value);
          // Preserve option order so the encoded string is deterministic.
          const ordered = options.map((o) => o.value).filter((v) => selected.has(v));
          field.onChange(joinCheckboxSelection(ordered));
        };
        return (
          <FormField label={label} required={required} error={error} htmlFor={`${htmlFor}-0`}>
            <div role="group" aria-label={label} className="space-y-2">
              {options.map((option, index) => {
                const optionId = `${htmlFor}-${index}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={optionId}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      id={optionId}
                      value={option.value}
                      checked={selected.has(option.value)}
                      onChange={(event) => toggle(option.value, event.target.checked)}
                      onBlur={field.onBlur}
                      className="size-4 accent-primary"
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </FormField>
        );
      }}
    />
  );
}
