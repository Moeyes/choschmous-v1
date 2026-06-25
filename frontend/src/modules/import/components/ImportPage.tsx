'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import {
  Button,
  PageShell,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared';
import { useCascadingData, useCategories } from '@/modules/registration/hooks';
import { useCommitImport, useValidateImport, downloadTemplate } from '../hooks/useImport';
import type { ImportContext, ImportReport } from '../types';
import { ImportReportTable } from './ImportReportTable';

function pickName(locale: string, kh?: string | null, en?: string | null): string {
  return (locale === 'kh' ? kh || en : en || kh) || '';
}

export function ImportPage() {
  const t = useTranslations('import');
  const locale = useLocale();

  const { data: ref } = useCascadingData();
  const [eventId, setEventId] = useState<number | undefined>();
  const [organizationId, setOrganizationId] = useState<number | undefined>();
  const [sportId, setSportId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [force, setForce] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: categories } = useCategories(eventId, sportId);
  const validate = useValidateImport();
  const commit = useCommitImport();

  const events = ref?.events ?? [];
  const orgs = ref?.organizations ?? [];
  const sports = ref?.sports ?? [];

  const ctxReady = eventId != null && sportId != null && categoryId != null;
  const canRun = ctxReady && file != null;
  const busy = validate.isPending || commit.isPending;

  const ctx = (): ImportContext => ({
    eventId: eventId!,
    organizationId,
    sportId: sportId!,
    categoryId,
    force,
  });

  const runValidate = () => {
    if (!file || !ctxReady) return;
    validate.mutate({ file, ctx: ctx() }, { onSuccess: setReport });
  };
  const runImport = () => {
    if (!file || !ctxReady) return;
    commit.mutate({ file, ctx: ctx() }, { onSuccess: setReport });
  };

  return (
    <PageShell size="narrow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-heading">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void downloadTemplate()}>
          <Download className="size-4" />
          {t('downloadTemplate')}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-heading">{t('context')}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={t('event')} required>
            <Select
              value={eventId != null ? String(eventId) : ''}
              onValueChange={(v) => {
                setEventId(Number(v));
                setSportId(undefined);
                setCategoryId(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('event')} />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {pickName(locale, e.name_kh, e.name_en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('organization')}>
            <Select
              value={organizationId != null ? String(organizationId) : ''}
              onValueChange={(v) => setOrganizationId(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('organization')} />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {pickName(locale, o.name_kh, o.name_en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('sport')} required>
            <Select
              value={sportId != null ? String(sportId) : ''}
              onValueChange={(v) => {
                setSportId(Number(v));
                setCategoryId(undefined);
              }}
              disabled={eventId == null}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('sport')} />
              </SelectTrigger>
              <SelectContent>
                {sports.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {pickName(locale, s.name_kh, s.name_en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('category')} required>
            <Select
              value={categoryId != null ? String(categoryId) : ''}
              onValueChange={(v) => setCategoryId(Number(v))}
              disabled={sportId == null}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="size-4 rounded border-border"
          />
          {t('force')}
        </label>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">{t('instructions')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="size-4" />
            {file ? t('fileSelected', { name: file.name }) : t('selectFile')}
          </Button>
        </div>

        {!ctxReady && (
          <p className="mt-3 text-xs text-warning">{t('needContext')}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={runValidate} disabled={!canRun || busy} loading={validate.isPending}>
            {validate.isPending ? t('validating') : t('validate')}
          </Button>
          <Button onClick={runImport} disabled={!canRun || busy} loading={commit.isPending}>
            <Upload className="size-4" />
            {commit.isPending ? t('importing') : t('import')}
          </Button>
        </div>
      </div>

      {report && (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-heading">{t('resultTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('summary', {
              valid: report.valid,
              invalid: report.invalid,
              created: report.created,
              total: report.total,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.committed
              ? t('committedNotice', { created: report.created })
              : t('dryRunNotice')}
          </p>
          <div className="mt-4">
            <ImportReportTable report={report} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
