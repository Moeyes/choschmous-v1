'use client';

import { useSurveyStatus } from '@/modules/reports/hooks/useReportMutations';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { ContentPanel } from '@/shared';
import { Badge } from '@/shared/ui/Badge';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SurveyStatusBoardProps {
    eventId: number;
}

export function SurveyStatusBoard({ eventId }: SurveyStatusBoardProps) {
    const t = useTranslations('surveyStatus');
    const { can } = usePermissions();
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
    const { data, isLoading, isError } = useSurveyStatus(eventId, isAdmin);

    if (!isAdmin) return null;

    if (isLoading) {
        return (
            <ContentPanel>
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </ContentPanel>
        );
    }

    if (isError || !data) {
        return (
            <ContentPanel>
                <div className="flex items-center gap-3 p-6 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm">{t('failedToLoad')}</span>
                </div>
            </ContentPanel>
        );
    }

    return (
        <div className="space-y-6">
            <ContentPanel>
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-foreground">{t('organizationTable')}</h2>
                    <p className="text-sm text-muted-foreground">{t('organizationTableDesc')}</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-foreground">{t('orgName')}</th>
                                <th className="px-4 py-3 text-left font-medium text-foreground">{t('surveySport')}</th>
                                <th className="px-4 py-3 text-left font-medium text-foreground">{t('surveyNumber')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.organizations.map((org: { org_id: number; org_name_kh?: string; org_name_en?: string; survey_sport_submitted: boolean; survey_number_status?: string }) => (
                                <tr key={org.org_id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3 text-foreground">{org.org_name_kh || org.org_name_en}</td>
                                    <td className="px-4 py-3">
                                        {org.survey_sport_submitted ? (
                                            <Badge variant="success" size="sm" className="gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {t('submitted')}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" size="sm" className="gap-1 text-muted-foreground">
                                                <XCircle className="h-3 w-3" />
                                                {t('notSubmitted')}
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {org.survey_number_status ? (
                                            <Badge variant="success" size="sm" className="gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {t('done')}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" size="sm" className="gap-1 text-muted-foreground">
                                                <XCircle className="h-3 w-3" />
                                                {t('pending')}
                                            </Badge>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ContentPanel>

            <ContentPanel>
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-foreground">{t('federationTable')}</h2>
                    <p className="text-sm text-muted-foreground">{t('federationTableDesc')}</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-foreground">{t('sport')}</th>
                                <th className="px-4 py-3 text-left font-medium text-foreground">{t('categories')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {data.federation_sports.map((sport: { sport_id: number; sport_name_kh?: string; category_count: number }) => (
                                <tr key={sport.sport_id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3 text-foreground">{sport.sport_name_kh}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant="info" size="sm">{sport.category_count}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ContentPanel>
        </div>
    );
}
