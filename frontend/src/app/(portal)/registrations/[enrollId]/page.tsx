'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';
import { ParticipantDetail } from '@/modules/registration';

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.registrations);
  const params = useParams<{ enrollId: string }>();
  const searchParams = useSearchParams();

  // `role` selects athlete vs leader server-side; the list links carry it.
  // Default to athlete so a hand-typed URL still resolves to a valid table.
  const role = searchParams.get('role') === 'leader' ? 'leader' : 'athlete';
  const enrollId = Number(params.enrollId);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <ParticipantDetail enrollId={enrollId} role={role} />;
}
