'use client';

import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/shared';
import type { OpenSurveyFieldDef } from '../schema/openSurveyField.schema';
import { normalizeFieldType } from '../schema/openSurveyField.schema';

interface OpenSurveyFieldListProps {
  fields: OpenSurveyFieldDef[];
  onEdit: (field: OpenSurveyFieldDef) => void;
  onDeactivate: (field: OpenSurveyFieldDef) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  isReordering: boolean;
}

/**
 * Read-only list of an event's field definitions (ordered by sort_order). Pure
 * presentation: every action is delegated to the parent builder.
 */
export function OpenSurveyFieldList({
  fields,
  onEdit,
  onDeactivate,
  onMove,
  isReordering,
}: OpenSurveyFieldListProps) {
  const t = useTranslations('opensurvey.admin');
  const tType = useTranslations('opensurvey.admin.fieldTypes');

  if (fields.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        {t('noFields')}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {fields.map((field, index) => (
        <li
          key={field.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex flex-col">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('moveUp')}
              disabled={index === 0 || isReordering}
              onClick={() => onMove(index, -1)}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('moveDown')}
              disabled={index === fields.length - 1 || isReordering}
              onClick={() => onMove(index, 1)}
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{field.label_kh}</p>
            {field.label_en && (
              <p className="truncate text-xs text-muted-foreground">{field.label_en}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tType(normalizeFieldType(field.field_type))}
              {' · '}
              {field.required ? t('requiredBadge') : t('optionalBadge')}
              {!field.active && ` · ${t('inactiveBadge')}`}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('editField')}
            onClick={() => onEdit(field)}
          >
            <Pencil className="size-4" />
          </Button>
          {field.active && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('deleteField')}
              onClick={() => onDeactivate(field)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
