'use client';

import Link from 'next/link';
import { ArrowLeft, Accessibility } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/shared/ui';
import { routes } from '@/core/config/constants';
import { MinistryCrest } from './MinistryCrest';

/**
 * Accessibility statement (CHOS-404).
 *
 * Public-sector accessibility commitment + the conformance target (WCAG 2.1 AA),
 * how it is verified (automated axe-core gate in CI + manual keyboard/SR checks),
 * known limitations, and a feedback channel. Mirrors PrivacyPage's layout.
 */
export function AccessibilityPage() {
    const t = useTranslations('home');
    const ta = useTranslations('home.accessibility');

    const sections = ['commitment', 'standard', 'measures', 'limitations'] as const;

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <Link href={routes.home} className="flex min-w-0 items-center gap-3">
                        <MinistryCrest label={t('identity.en')} className="h-10 w-10 shrink-0" />
                        <div className="min-w-0">
                            <p className="truncate font-khmer text-sm font-bold leading-snug text-heading">
                                {t('identity.kh')}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{t('identity.en')}</p>
                        </div>
                    </Link>
                    <LanguageSwitcher />
                </div>
                <div aria-hidden className="flex h-1">
                    <span className="h-full flex-[3] bg-flag-blue" />
                    <span className="h-full flex-1 bg-flag-red" />
                    <span className="h-full flex-[3] bg-flag-blue" />
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
                <Link
                    href={routes.home}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> {ta('back')}
                </Link>

                <div className="mb-8 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">
                        <Accessibility className="h-6 w-6" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-bold text-heading sm:text-3xl">{ta('title')}</h1>
                        <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
                    </div>
                </div>

                <p className="mb-8 leading-relaxed text-muted-foreground">{ta('intro')}</p>

                <div className="space-y-8">
                    {sections.map((key) => (
                        <section key={key}>
                            <h2 className="mb-2 text-lg font-semibold text-foreground">
                                {ta(`sections.${key}.title`)}
                            </h2>
                            <p className="leading-relaxed text-muted-foreground">
                                {ta(`sections.${key}.body`)}
                            </p>
                        </section>
                    ))}
                </div>

                <p className="mt-10 rounded-lg border border-border bg-accent/40 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                    {ta('contact')}
                </p>
            </main>
        </div>
    );
}
