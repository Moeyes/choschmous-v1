'use client';

import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { OrganizationsPage } from '@/modules/organizations';

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.organizations);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <OrganizationsPage />;
}
