'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commitImport, validateImport } from '../api/importApi';
import type { ImportContext } from '../types';

interface RunArgs {
  file: File;
  ctx: ImportContext;
}

export function useValidateImport() {
  return useMutation({
    mutationFn: ({ file, ctx }: RunArgs) => validateImport(file, ctx),
    meta: { suppressErrorToast: true },
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, ctx }: RunArgs) => commitImport(file, ctx),
    onSuccess: () => {
      // New enrollments affect registrations + dashboards.
      qc.invalidateQueries({ queryKey: ['registrations'] });
    },
    meta: { suppressErrorToast: true },
  });
}

export { downloadTemplate } from '../api/importApi';
