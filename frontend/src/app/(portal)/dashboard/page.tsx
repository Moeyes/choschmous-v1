'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { DashboardPage } from '@/modules/dashboard';

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.dashboard);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <DashboardPage />;
}
