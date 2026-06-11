'use client';

import dynamic from 'next/dynamic';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';

const ByNumberPage = dynamic(() => import('@/modules/bynumber').then((m) => m.ByNumberPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.bynumber);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <ByNumberPage />;
}
