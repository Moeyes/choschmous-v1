'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { RegistrationsPage } from '@/modules/registration';

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.registrations);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <RegistrationsPage />;
}
