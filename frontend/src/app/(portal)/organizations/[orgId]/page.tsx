'use client';

import { use } from 'react';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { OrganizationDetailPage } from '@/modules/organizations';

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default function Page({ params }: PageProps) {
  const { orgId } = use(params);
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.organizations);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <OrganizationDetailPage orgId={Number(orgId)} />;
}
