'use client';

import { useFieldArray } from 'react-hook-form';
import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { ByCategoryFormInput, ByCategoryFormData, CategoryRow } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared';

interface ByCategoryCategoriesStepProps {
  form: UseFormReturn<ByCategoryFormInput, unknown, ByCategoryFormData>;
  onCopyFromPrevious: () => Promise<void>;
  hasPrevious: boolean;
  copyPending: boolean;
}

export function ByCategoryCategoriesStep({
  form,
  onCopyFromPrevious,
  hasPrevious,
  copyPending,
}: ByCategoryCategoriesStepProps) {
  const t = useTranslations('bycategory');
  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'categories' as const,
  });

  const genders = [
    { value: 'MALE', label: t('genders.male') },
    { value: 'FEMALE', label: t('genders.female') },
    { value: 'MIXED', label: t('genders.mixed') },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle subtitle={t('steps.categories.subtitle')}>
            {t('steps.categories.title')}
          </CardTitle>
          {hasPrevious && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={copyPending}
              onClick={onCopyFromPrevious}
            >
              <Copy className="mr-2 size-4" />
              {t('steps.categories.copyFromPrevious')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-3">
            <div className="flex-1">
              <Input
                {...form.register(`categories.${index}.name` as const)}
                placeholder={t('steps.categories.namePlaceholder')}
              />
            </div>
            <div className="w-36">
              <Select
                value={form.watch(`categories.${index}.gender` as const)}
                onValueChange={(val) => {
                  setValue(
                    `categories.${index}.gender` as const,
                    val as 'MALE' | 'FEMALE' | 'MIXED',
                    { shouldValidate: true },
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('steps.categories.genderPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              className="mt-0.5 shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => append({ name: '', gender: 'MALE' })}
        >
          <Plus className="mr-2 size-4" />
          {t('steps.categories.addRow')}
        </Button>

        {fields.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {t('steps.categories.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
