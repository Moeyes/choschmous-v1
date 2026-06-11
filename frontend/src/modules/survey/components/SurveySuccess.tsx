'use client';

import { useTranslations } from 'next-intl';
import { Check, UserPlus } from 'lucide-react';
import { Card, Button } from '@/shared';

interface SurveySuccessProps {
    onRegisterAnother?: () => void;
}

export function SurveySuccess({ onRegisterAnother }: SurveySuccessProps) {
    const t = useTranslations('registration.success');
    return (
        <div className="mx-auto max-w-lg">
            <Card className="overflow-hidden text-center">
                <div className="bg-gradient-to-b from-success/10 to-success/5 px-8 pb-8 pt-12">
                    <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-success shadow-lg shadow-success/20">
                        <Check className="size-9 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
                </div>
                {onRegisterAnother && (
                    <div className="border-t border-border px-6 py-5">
                        <Button
                            variant="default"
                            className="w-full gap-2"
                            size="lg"
                            onClick={onRegisterAnother}
                        >
                            <UserPlus className="size-4" />
                            {t('registerAnother')}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
