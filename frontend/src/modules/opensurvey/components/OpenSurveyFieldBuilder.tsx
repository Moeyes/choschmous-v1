'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/shared';
import { FormField } from '@/shared/form/FormField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useEvents } from '@/modules/events/hooks';
import { useOpenSurveyFields, useMutateOpenSurveyFields } from '../hooks';
import { OpenSurveyFieldList } from './OpenSurveyFieldList';
import { OpenSurveyFieldDialog } from './OpenSurveyFieldDialog';
import type { OpenSurveyFieldDef, OpenSurveyFieldReorderItem } from '../schema/openSurveyField.schema';

interface DialogState {
  isOpen: boolean;
  editing?: OpenSurveyFieldDef;
}

/**
 * Admin field-builder: define the open-survey fields organizations fill for an
 * event. Admins aren't org-bound, so the event picker reuses the full events
 * list. Thin orchestrator — list + dialog do the work; mutations live in hooks.
 */
export function OpenSurveyFieldBuilder() {
  const t = useTranslations('opensurvey.admin');

  const [eventId, setEventId] = useState<number | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false });

  const { data: events = [] } = useEvents();
  const { data: fields = [], isLoading, isError } = useOpenSurveyFields(eventId, includeInactive);
  const { deactivate, reorder } = useMutateOpenSurveyFields(eventId ?? 0);

  const selectedEventName = events.find((e) => e.id === eventId)?.name;
  const nextSortOrder = fields.length === 0 ? 0 : Math.max(...fields.map((f) => f.sort_order)) + 1;

  const handleDeactivate = (field: OpenSurveyFieldDef) => {
    if (window.confirm(t('deleteConfirm'))) deactivate.mutate(field.id);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const reordered = [...fields];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Renumber to 0..n-1 so the order is deterministic even if sort_orders
    // collided (e.g. several fields created with the same default), and PATCH
    // only the fields whose sort_order actually changed.
    const items: OpenSurveyFieldReorderItem[] = reordered
      .map((field, i) => ({ fieldId: field.id, sortOrder: i }))
      .filter((item) => {
        const original = fields.find((field) => field.id === item.fieldId);
        return original ? original.sort_order !== item.sortOrder : false;
      });
    if (items.length > 0) reorder.mutate(items);
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <FormField label={t('eventLabel')} htmlFor="osf-event">
        <Select
          value={eventId ? String(eventId) : ''}
          onValueChange={(v) => setEventId(v ? Number(v) : null)}
        >
          <SelectTrigger id="osf-event" className="w-full">
            <SelectValue placeholder={t('eventPlaceholder')}>{selectedEventName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event.id} value={String(event.id)}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {eventId === null ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t('selectEventPrompt')}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span>{t('showInactive')}</span>
            </label>
            <Button size="sm" onClick={() => setDialog({ isOpen: true })}>
              <Plus className="size-4" />
              {t('addField')}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t('loading')}
            </div>
          ) : isError ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-destructive shadow-sm">
              {t('loadError')}
            </p>
          ) : (
            <OpenSurveyFieldList
              fields={fields}
              onEdit={(field) => setDialog({ isOpen: true, editing: field })}
              onDeactivate={handleDeactivate}
              onMove={handleMove}
              isReordering={reorder.isPending}
            />
          )}
        </div>
      )}

      {eventId !== null && dialog.isOpen && (
        <OpenSurveyFieldDialog
          key={dialog.editing?.id ?? 'new'}
          eventId={eventId}
          field={dialog.editing}
          nextSortOrder={nextSortOrder}
          isOpen={dialog.isOpen}
          onClose={() => setDialog({ isOpen: false })}
        />
      )}
    </main>
  );
}
