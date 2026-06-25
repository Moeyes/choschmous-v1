'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/shared/ui/Modal';
import { FormField } from '@/shared/form/FormField';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useMutateOpenSurveyFields } from '../hooks';
import { OpenSurveyFieldOptionsEditor } from './OpenSurveyFieldOptionsEditor';
import {
  OPEN_SURVEY_FIELD_TYPES,
  buildOpenSurveyFieldFormSchema,
  fieldToFormValues,
  formValuesToCreateDto,
  formValuesToUpdateDto,
  isChoiceFieldType,
  type OpenSurveyFieldDef,
  type OpenSurveyFieldFormValues,
  type OpenSurveyFieldOptionInput,
  type OpenSurveyFieldType,
} from '../schema/openSurveyField.schema';

interface OpenSurveyFieldDialogProps {
  eventId: number;
  // undefined → create; present → edit.
  field?: OpenSurveyFieldDef;
  // sort_order assigned to a newly created field (appended at the end).
  nextSortOrder: number;
  isOpen: boolean;
  onClose: () => void;
}

interface FieldFormErrors {
  labelKh?: string;
  options?: string;
  optionValues?: Record<number, string>;
}

export function OpenSurveyFieldDialog({
  eventId,
  field,
  nextSortOrder,
  isOpen,
  onClose,
}: OpenSurveyFieldDialogProps) {
  const t = useTranslations('opensurvey.admin.dialog');
  const tType = useTranslations('opensurvey.admin.fieldTypes');
  const tValidation = useTranslations('opensurvey.admin.validation');
  const tCommon = useTranslations('common');
  const { create, update } = useMutateOpenSurveyFields(eventId);

  const [values, setValues] = useState<OpenSurveyFieldFormValues>(() =>
    fieldToFormValues(field, nextSortOrder),
  );
  const [errors, setErrors] = useState<FieldFormErrors>({});

  const isEdit = field !== undefined;
  const isChoice = isChoiceFieldType(values.field_type);
  const isPending = create.isPending || update.isPending;

  const patch = (next: Partial<OpenSurveyFieldFormValues>) => setValues((v) => ({ ...v, ...next }));
  const setType = (next: OpenSurveyFieldType) =>
    // Switching away from a choice type drops its options (text/number carry none).
    patch({ field_type: next, options: isChoiceFieldType(next) ? values.options : [] });
  const setOptions = (options: OpenSurveyFieldOptionInput[]) => patch({ options });

  const handleSave = () => {
    const schema = buildOpenSurveyFieldFormSchema({
      labelKhRequired: tValidation('labelKhRequired'),
      optionsRequired: tValidation('optionsRequired'),
      optionEmpty: tValidation('optionEmpty'),
      optionDuplicate: tValidation('optionDuplicate'),
      optionComma: tValidation('optionComma'),
    });
    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues));
      return;
    }
    setErrors({});
    if (field) {
      update.mutate({ fieldId: field.id, dto: formValuesToUpdateDto(result.data) }, { onSuccess: onClose });
    } else {
      create.mutate(formValuesToCreateDto(result.data), { onSuccess: onClose });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('editTitle') : t('createTitle')}
      size="md"
      cancelText={tCommon('cancel')}
      confirmText={isPending ? tCommon('saving') : tCommon('save')}
      confirmLoading={isPending}
      onConfirm={handleSave}
    >
      <div className="space-y-5">
        <FormField label={t('labelKh')} required htmlFor="osf-label-kh" error={errors.labelKh}>
          <Input
            id="osf-label-kh"
            value={values.label_kh}
            onChange={(e) => patch({ label_kh: e.target.value })}
          />
        </FormField>

        <FormField label={t('labelEn')} htmlFor="osf-label-en">
          <Input
            id="osf-label-en"
            value={values.label_en}
            onChange={(e) => patch({ label_en: e.target.value })}
          />
        </FormField>

        <FormField label={t('fieldType')} htmlFor="osf-field-type">
          <Select value={values.field_type} onValueChange={(v) => setType(v as OpenSurveyFieldType)}>
            <SelectTrigger id="osf-field-type" className="w-full">
              <SelectValue>{tType(values.field_type)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OPEN_SURVEY_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {tType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {isChoice && (
          <OpenSurveyFieldOptionsEditor
            options={values.options}
            onChange={setOptions}
            valueErrors={errors.optionValues}
            generalError={errors.options}
          />
        )}

        <div className="flex flex-wrap gap-6">
          <label htmlFor="osf-required" className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              id="osf-required"
              checked={values.required}
              onChange={(e) => patch({ required: e.target.checked })}
              className="size-4 accent-primary"
            />
            <span>{t('required')}</span>
          </label>
          {isEdit && (
            <label htmlFor="osf-active" className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                id="osf-active"
                checked={values.active}
                onChange={(e) => patch({ active: e.target.checked })}
                className="size-4 accent-primary"
              />
              <span>{t('active')}</span>
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Map Zod issues to the dialog's error shape. Paths: ['label_kh'],
// ['options'] (list-level), ['options', index, 'value'] (per-row value).
function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldFormErrors {
  const errors: FieldFormErrors = {};
  for (const issue of issues) {
    const [root, index, leaf] = issue.path;
    if (root === 'label_kh') {
      errors.labelKh ??= issue.message;
    } else if (root === 'options' && typeof index === 'number' && leaf === 'value') {
      (errors.optionValues ??= {})[index] ??= issue.message;
    } else if (root === 'options') {
      errors.options ??= issue.message;
    }
  }
  return errors;
}
