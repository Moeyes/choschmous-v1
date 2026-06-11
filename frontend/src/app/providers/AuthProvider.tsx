/**
 * Auth Provider Wrapper
 * 
 * Client component that wraps the AuthProvider from the auth feature
 */

'use client';

import { AuthProvider } from '@/core/auth';
import { ReactNode } from 'react';

export function AppAuthProvider({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
}
