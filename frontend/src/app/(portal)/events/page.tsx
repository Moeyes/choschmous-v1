'use client';

import dynamic from 'next/dynamic';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';

const EventsPage = dynamic(() => import('@/modules/events').then((m) => m.EventsPage), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  const { isLoading, hasRole } = useRequireRole(FEATURE_ACCESS.events);

  if (isLoading) return <PageLoadingState />;
  if (!hasRole) return null;

  return <EventsPage />;
}
