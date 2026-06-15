'use client';

import { useTranslations } from 'next-intl';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/shared';
import { Input } from '@/shared/ui/input';
import type { OpenSurveyFieldOptionInput } from '../schema/openSurveyField.schema';

interface OpenSurveyFieldOptionsEditorProps {
  options: OpenSurveyFieldOptionInput[];
  onChange: (next: OpenSurveyFieldOptionInput[]) => void;
  // Per-row value errors keyed by index, plus a list-level error (e.g. "≥1 required").
  valueErrors?: Record<number, string>;
  generalError?: string;
}

/**
 * Choice-field options editor. Each row carries a `value` (stored/round-tripped —
 * must be unique and comma-free) and a `label` (display text for orgs). Pure
 * controlled component: all state lives in the parent dialog's form object.
 */
export function OpenSurveyFieldOptionsEditor({
  options,
  onChange,
  valueErrors = {},
  generalError,
}: OpenSurveyFieldOptionsEditorProps) {
  const t = useTranslations('opensurvey.admin.dialog');

  const setRow = (index: number, patch: Partial<OpenSurveyFieldOptionInput>) =>
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  const removeRow = (index: number) => onChange(options.filter((_, i) => i !== index));
  const addRow = () => onChange([...options, { value: '', label: '' }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">{t('options')}</label>
        <Button type="button" variant="secondary" size="xs" onClick={addRow}>
          <Plus className="size-3.5" />
          {t('addOption')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('optionsHint')}</p>

      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
          {t('noOptions')}
        </p>
      ) : (
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    aria-label={t('optionValue')}
                    placeholder={t('optionValue')}
                    value={option.value}
                    onChange={(e) => setRow(index, { value: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    aria-label={t('optionLabel')}
                    placeholder={t('optionLabel')}
                    value={option.label}
                    onChange={(e) => setRow(index, { label: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('removeOption')}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {valueErrors[index] && (
                <p className="text-xs font-medium text-destructive">{valueErrors[index]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {generalError && <p className="text-xs font-medium text-destructive">{generalError}</p>}
    </div>
  );
}
