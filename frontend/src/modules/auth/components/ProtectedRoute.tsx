/**
 * ProtectedRoute Component
 *
 * Single component that handles:
 *  - Loading state (spinner)
 *  - Unauthenticated → redirect to login (with returnUrl)
 *  - Wrong role → redirect to /unauthorized
 *  - Authorized → render children
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/core/auth/context';
import { useRequireAuth } from '@/core/auth/hooks';
import { UserRole } from '@/core/auth/types';
import { Button } from '@/shared/ui/button';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
    const { isLoading, isAuthenticated } = useRequireAuth();
    const { canAccess } = useAuth();
    const router = useRouter();
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            // Reset stuck state asynchronously when loading finishes
            const t = setTimeout(() => setIsStuck(false), 0);
            return () => clearTimeout(t);
        }

        const timer = setTimeout(() => {
            setIsStuck(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, [isLoading]);

    useEffect(() => {
        if (isLoading || !isAuthenticated) return;

        if (requiredRoles && !canAccess(requiredRoles)) {
            router.replace('/unauthorized');
        }
    }, [isLoading, isAuthenticated, requiredRoles, canAccess, router]);

    if (isLoading && !isStuck) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (isStuck || !isAuthenticated) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-2">
                        {isStuck ? 'Loading taking longer than expected...' : 'Redirecting to login...'}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        {isStuck ? 'There might be a connection issue.' : 'If you are not redirected, click the button below.'}
                    </p>
                    <Button onClick={() => router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`)}>
                        Go to Login
                    </Button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
