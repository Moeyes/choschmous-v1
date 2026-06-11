'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore, type MouseEvent } from 'react';
import { ArrowRight, BarChart3, Calendar, Landmark, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { LanguageSwitcher } from '@/shared/ui';
import { useAuth } from '@/core/auth';
import { routes } from '@/core/config/constants';

export function HomePage() {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();
    const t = useTranslations('home');
    const mounted = useSyncExternalStore(
        (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); },
        () => true,
        () => false,
    );

    const handleRegisterClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        router.push(isAuthenticated ? routes.register : routes.login);
    };

    const features = [
        { icon: Users, title: t('features.registration.title'), description: t('features.registration.description') },
        { icon: Calendar, title: t('features.events.title'), description: t('features.events.description') },
        { icon: BarChart3, title: t('features.analytics.title'), description: t('features.analytics.description') },
    ];

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b border-border bg-card">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Landmark className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold leading-snug text-foreground">
                                    {t('brand')}
                                </p>
                                <p className="truncate text-xs leading-relaxed text-muted-foreground">
                                    {t('ministry')}
                                </p>
                            </div>
                        </div>

                        <nav className="flex items-center gap-2 sm:gap-3">
                            <LanguageSwitcher />
                            {mounted && isAuthenticated ? (
                                <>
                                    <span className="hidden text-sm text-muted-foreground sm:inline">
                                        {user?.khmer_name || user?.english_name}
                                    </span>
                                    <Link href={routes.dashboard}>
                                        <Button variant="default" size="sm">
                                            {t('nav.dashboard')}
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href={routes.login}>
                                        <Button variant="outline" size="sm">
                                            {t('nav.signIn')}
                                        </Button>
                                    </Link>
                                    <Link href={routes.login} onClick={handleRegisterClick}>
                                        <Button variant="default" size="sm">
                                            {t('nav.register')}
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            <main>
                <section className="px-4 py-24 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-4xl text-center">
                        <h1 className="mb-6 text-4xl font-bold text-foreground sm:text-5xl">
                            {t('hero.title')}
                        </h1>
                        <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                            {t('hero.subtitle')}
                        </p>

                        {mounted && !isAuthenticated && (
                            <div className="flex flex-col justify-center gap-4 sm:flex-row">
                                <Link href={routes.login} onClick={handleRegisterClick}>
                                    <Button size="lg" className="w-full gap-2 sm:w-auto">
                                        {t('hero.getStarted')} <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </Link>
                                <Link href={routes.login}>
                                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                                        {t('hero.signIn')}
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                <section className="border-t border-border bg-card px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <h2 className="mb-12 text-center text-2xl font-bold text-foreground sm:text-3xl">
                            {t('features.title')}
                        </h2>

                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            {features.map((feature) => (
                                <div key={feature.title} className="rounded-lg border border-border bg-background p-8">
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">
                                        <feature.icon className="h-6 w-6" />
                                    </div>
                                    <h3 className="mb-3 text-lg font-semibold text-foreground">{feature.title}</h3>
                                    <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="px-4 py-20 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-3xl text-center">
                        <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-3xl">{t('cta.title')}</h2>
                        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                            {t('cta.subtitle')}
                        </p>

                        {mounted && !isAuthenticated && (
                            <Link href={routes.login} onClick={handleRegisterClick}>
                                <Button size="lg">{t('cta.register')}</Button>
                            </Link>
                        )}
                    </div>
                </section>
            </main>

            <footer className="border-t border-border bg-card py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center text-sm leading-relaxed text-muted-foreground">
                        <p>© {new Date().getFullYear()} {t('footer.rights')}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
