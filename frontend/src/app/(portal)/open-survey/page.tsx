'use client';

import dynamic from 'next/dynamic';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';

const OpenSurveyPage = dynamic(
  () => import('@/modules/opensurvey').then((m) => m.OpenSurveyPage),
  { loading: () => <PageLoadingState /> },
);

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.opensurvey);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <OpenSurveyPage />;
}
