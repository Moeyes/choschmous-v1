// CHOS-406: bulk athlete import HTTP calls (multipart upload + template download).

import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { ImportContext, ImportReport } from '../types';

function toFormData(file: File, ctx: ImportContext): FormData {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('eventId', String(ctx.eventId));
  if (ctx.organizationId != null) fd.append('organizationId', String(ctx.organizationId));
  fd.append('sportId', String(ctx.sportId));
  if (ctx.categoryId != null) fd.append('categoryId', String(ctx.categoryId));
  fd.append('force', String(ctx.force ?? false));
  return fd;
}

// Let the browser/axios set the multipart boundary (override the client's
// default application/json content-type).
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export async function validateImport(file: File, ctx: ImportContext): Promise<ImportReport> {
  const { data } = await apiClient.post<ImportReport>(
    API.imports.validate,
    toFormData(file, ctx),
    MULTIPART,
  );
  return data;
}

export async function commitImport(file: File, ctx: ImportContext): Promise<ImportReport> {
  const { data } = await apiClient.post<ImportReport>(
    API.imports.commit,
    toFormData(file, ctx),
    MULTIPART,
  );
  return data;
}

export async function downloadTemplate(): Promise<void> {
  const { data } = await apiClient.get<Blob>(API.imports.template, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'athlete-import-template.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
