'use client';

import { useRouter } from 'next/navigation';
import { ShieldX } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useAuth } from '@/core/auth';
import { ROLE_DEFAULT_ROUTE } from '@/core/config/constants';
import { useTranslations } from 'next-intl';

export function UnauthorizedPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const t = useTranslations('unauthorized');

    const handleGoHome = () => {
        if (user) {
            router.push(ROLE_DEFAULT_ROUTE[user.role]);
            return;
        }
        router.push('/login');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="max-w-md text-center">
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-destructive/10 p-4">
                        <ShieldX className="h-12 w-12 text-destructive" />
                    </div>
                </div>
                <h1 className="mb-3 text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="mb-2 text-muted-foreground">{t('noPermission')}</p>
                {user && (
                    <p className="mb-8 text-sm text-muted-foreground">
                        {t('signedInAs')} <span className="font-medium text-foreground">{user.username}</span> ({user.role})
                    </p>
                )}
                <div className="flex justify-center gap-3">
                    <Button onClick={handleGoHome}>{t('goToDashboard')}</Button>
                    <Button variant="outline" onClick={logout}>{t('signOut')}</Button>
                </div>
            </div>
        </div>
    );
}
