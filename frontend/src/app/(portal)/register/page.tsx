'use client';

import dynamic from 'next/dynamic';
import { useRequireRole, FEATURE_ACCESS } from '@/core/auth';
import { PageLoadingState } from '@/shared';

const RegisterForm = dynamic(() => import('@/modules/registration').then((m) => m.RegisterForm), {
  loading: () => <PageLoadingState />,
});

export default function Page() {
  useRequireRole(FEATURE_ACCESS.register);
  return <RegisterForm mode="athlete" />;
}
