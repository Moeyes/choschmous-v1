/**
 * useRequireRole Hook
 * 
 * Hook to ensure user has required role(s), redirect to unauthorized page if not
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/core/auth/context';
import { UserRole } from '@/core/auth/types';

export function useRequireRole(requiredRoles: UserRole | UserRole[]) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!hasRole(requiredRoles)) {
      router.push('/unauthorized');
    }
  }, [isLoading, isAuthenticated, requiredRoles, hasRole, router, pathname]);

  return { isAuthenticated, hasRole: hasRole(requiredRoles), isLoading };
}
