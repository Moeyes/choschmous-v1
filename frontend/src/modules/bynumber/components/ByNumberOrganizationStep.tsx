'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';
import type { ByNumberFormInput, ByNumberFormData, Organization } from '../types';
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from '@/shared';

interface ByNumberOrganizationStepProps {
    form: UseFormReturn<ByNumberFormInput, unknown, ByNumberFormData>;
    organizations: Organization[];
}

export function ByNumberOrganizationStep({ form, organizations }: ByNumberOrganizationStepProps) {
    const { watch, setValue, trigger } = form;
    const t = useTranslations('bynumber');
    const selectedOrgId = watch('organizationId');

    if (organizations.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle icon={Building2} subtitle={t('subtitle')}>
                        {t('headings.organization')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                        {t('noOrgs')}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const options = organizations.map((org) => ({
        value: String(org.id),
        label: org.name_kh,
        description: org.type || undefined,
        icon: Building2,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={Building2} subtitle={t('subtitle')}>
                    {t('headings.organization')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                    <RadioCardGroup
                        options={options}
                        value={selectedOrgId != null ? String(selectedOrgId) : null}
                        onChange={(id) => {
                            setValue('organizationId', Number(id));
                            trigger('organizationId');
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
