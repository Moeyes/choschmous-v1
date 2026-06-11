'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { SportsPage } from '@/modules/sports';

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.sports);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <SportsPage />;
}
