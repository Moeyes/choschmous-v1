'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import {
    ArrowRight,
    BarChart3,
    Calendar,
    Info,
    KeyRound,
    LineChart,
    Users,
    UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { LanguageSwitcher } from '@/shared/ui';
import { useAuth } from '@/core/auth';
import { routes } from '@/core/config/constants';
import { MinistryCrest } from './MinistryCrest';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '—';

export function HomePage() {
    const { isAuthenticated, user } = useAuth();
    const t = useTranslations('home');
    const mounted = useSyncExternalStore(
        (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); },
        () => true,
        () => false,
    );

    const features = [
        { icon: Users, title: t('features.registration.title'), description: t('features.registration.description') },
        { icon: Calendar, title: t('features.events.title'), description: t('features.events.description') },
        { icon: BarChart3, title: t('features.analytics.title'), description: t('features.analytics.description') },
    ];

    const steps = [
        { icon: KeyRound, title: t('howItWorks.step1.title'), description: t('howItWorks.step1.description') },
        { icon: UserPlus, title: t('howItWorks.step2.title'), description: t('howItWorks.step2.description') },
        { icon: LineChart, title: t('howItWorks.step3.title'), description: t('howItWorks.step3.description') },
    ];

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b border-border bg-card">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <MinistryCrest label={t('identity.en')} className="h-11 w-11 shrink-0" />
                            <div className="min-w-0">
                                <p className="truncate font-khmer text-base font-bold leading-snug text-heading">
                                    {t('identity.kh')}
                                </p>
                                <p className="truncate text-xs leading-relaxed text-muted-foreground">
                                    {t('identity.en')}
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
                                <Link href={routes.login}>
                                    <Button variant="default" size="sm">
                                        {t('nav.signIn')}
                                    </Button>
                                </Link>
                            )}
                        </nav>
                    </div>
                </div>
                {/* National-colors accent bar (Cambodian flag: blue / red) */}
                <div aria-hidden className="flex h-1">
                    <span className="h-full flex-[3] bg-flag-blue" />
                    <span className="h-full flex-1 bg-flag-red" />
                    <span className="h-full flex-[3] bg-flag-blue" />
                </div>
            </header>

            <main>
                <section className="px-4 py-20 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-4xl text-center">
                        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
                            {t('identity.system')}
                        </p>
                        <h1 className="mb-3 font-khmer text-3xl font-bold leading-tight text-heading sm:text-5xl">
                            {t('hero.headlineKh')}
                        </h1>
                        <p className="mb-6 text-lg font-medium text-muted-foreground sm:text-xl">
                            {t('hero.headlineEn')}
                        </p>
                        <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground">
                            {t('hero.lead')}
                        </p>

                        {mounted && isAuthenticated ? (
                            <Link href={routes.dashboard}>
                                <Button size="lg" className="gap-2">
                                    {t('nav.dashboard')} <ArrowRight className="h-5 w-5" />
                                </Button>
                            </Link>
                        ) : (
                            <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
                                <Link href={routes.login}>
                                    <Button size="lg" className="gap-2">
                                        {t('hero.signIn')} <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </Link>
                                <p className="flex items-start gap-2 rounded-lg border border-border bg-accent/40 px-4 py-3 text-left text-sm leading-relaxed text-muted-foreground">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                                    <span>{t('hero.accessNote')}</span>
                                </p>
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

                <section className="px-4 py-16 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-5xl">
                        <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
                            {t('howItWorks.title')}
                        </h2>
                        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {steps.map((step, index) => (
                                <li key={step.title} className="relative rounded-lg border border-border bg-card p-6">
                                    <div className="mb-4 flex items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                            {index + 1}
                                        </span>
                                        <step.icon className="h-5 w-5 text-primary" aria-hidden />
                                    </div>
                                    <h3 className="mb-2 text-base font-semibold text-foreground">{step.title}</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                                </li>
                            ))}
                        </ol>

                        <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-accent/40 px-5 py-4 text-center text-sm leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-foreground">{t('supportedEvents.label')}: </span>
                            {t('supportedEvents.value')}
                        </p>
                    </div>
                </section>
            </main>

            <footer className="border-t border-border bg-card">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex items-start gap-3">
                            <MinistryCrest label={t('identity.en')} className="h-10 w-10 shrink-0" />
                            <div>
                                <p className="font-khmer text-sm font-semibold text-heading">{t('identity.kh')}</p>
                                <p className="text-sm text-muted-foreground">{t('footer.ministry')}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('footer.address')}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {t('footer.supportLabel')}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('footer.support')}</p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                {t('footer.legalLabel')}
                            </p>
                            <Link
                                href={routes.privacy}
                                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                            >
                                {t('footer.privacy')}
                            </Link>
                            <p className="mt-3 text-xs text-muted-foreground">
                                {t('footer.version')} {APP_VERSION}
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-border pt-6 text-center text-xs leading-relaxed text-muted-foreground">
                        © {new Date().getFullYear()} {t('footer.rights')}
                    </div>
                </div>
            </footer>
        </div>
    );
}
