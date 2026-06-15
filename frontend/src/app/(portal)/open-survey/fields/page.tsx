'use client';

import dynamic from 'next/dynamic';
import { useRequireRole, UserRole } from '@/core/auth';
import { PageLoadingState } from '@/shared';

const OpenSurveyFieldBuilder = dynamic(
  () => import('@/modules/opensurvey').then((m) => m.OpenSurveyFieldBuilder),
  { loading: () => <PageLoadingState /> },
);

// Producer side is admin-only (the server re-checks via require_admin; this gate
// is UX only). Defined at module scope so the array reference stays stable.
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(ADMIN_ROLES);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <OpenSurveyFieldBuilder />;
}
