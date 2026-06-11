'use client';

import { useState } from 'react';
import { useReportMutations } from '../hooks/useReportMutations';
import { usePermissions, CAPABILITIES } from '@/core/auth';
import { useCascadingData } from '@/modules/registration/hooks/useCascadingData';
import {
    ClipboardList,
    LayoutGrid,
    ListOrdered,
    Image as ImageIcon,
    Users,
    Award,
    Dumbbell,
    UserCog,
    Loader2,
    type LucideIcon,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/utils/cn';
import { useTranslations } from 'next-intl';
import { ReportGenerateModal } from './ReportGenerateModal';

// Report key maps an available card to the existing download mutation.
type ReportKey = 'orgSport' | 'participant';

interface ReportCard {
    id: string;
    titleKh: string;
    descEn: string;
    icon: LucideIcon;
    reportKey: ReportKey | null; // null = coming soon
}

// Titles are official Khmer report names (REPORTS_SPEC); descriptions are short English.
const REPORT_CARDS: ReportCard[] = [
    { id: 'RPT-1', titleKh: 'ចុះប្រភេទកីឡា', descEn: 'Sport registration list', icon: ClipboardList, reportKey: null },
    { id: 'RPT-2', titleKh: 'ចំនួនរួម', descEn: 'Total counts matrix', icon: LayoutGrid, reportKey: null },
    { id: 'RPT-3', titleKh: 'ចុះចំនួន', descEn: 'Number per organization', icon: ListOrdered, reportKey: 'orgSport' },
    { id: 'RPT-4', titleKh: 'អាល់ប៊ុម', descEn: 'Photo album', icon: ImageIcon, reportKey: null },
    { id: 'RPT-5', titleKh: 'រាយនាមរួម', descEn: 'Combined roster', icon: Users, reportKey: 'participant' },
    { id: 'RPT-6', titleKh: 'ថ្នាក់ដឹកនាំគ្រប់ប្រភេទកីឡា', descEn: 'Leadership all sports', icon: Award, reportKey: null },
    { id: 'RPT-7', titleKh: 'គ្រូបង្វឹក អត្តពលិក', descEn: 'Coaches and athletes', icon: Dumbbell, reportKey: null },
    { id: 'RPT-8', titleKh: 'ប្រតិភូ អ្នកដឹកនាំ', descEn: 'Delegates and leaders', icon: UserCog, reportKey: null },
];

export function ReportList() {
    const { can } = usePermissions();
    const t = useTranslations('reports');
    const reports = useReportMutations();

    const { data: cascadingData, isLoading } = useCascadingData();
    const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Per-report mutation wiring (download logic unchanged — these are existing mutations).
    const mutationFor = (key: ReportKey) =>
        key === 'orgSport'
            ? {
                  onGenerate: reports.downloadOrgSport,
                  isGenerating: reports.isDownloadingOrgSport,
                  isDone: reports.isOrgSportDone,
                  onReset: reports.resetOrgSport,
              }
            : {
                  onGenerate: reports.downloadParticipant,
                  isGenerating: reports.isDownloadingParticipant,
                  isDone: reports.isParticipantDone,
                  onReset: reports.resetParticipant,
              };

    const active = activeReport ? mutationFor(activeReport) : null;
    const activeCard = REPORT_CARDS.find((c) => c.reportKey === activeReport);

    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {REPORT_CARDS.map((card) => {
                    const available = card.reportKey !== null;
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.id}
                            className={cn(
                                'flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow',
                                available && 'hover:shadow-md',
                            )}
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div
                                    className={cn(
                                        'flex h-11 w-11 items-center justify-center rounded-lg',
                                        available ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>
                                <Badge variant={available ? 'success' : 'secondary'} size="sm">
                                    {available ? t('statusAvailable') : t('statusComingSoon')}
                                </Badge>
                            </div>

                            <h3 className="text-base font-semibold leading-relaxed text-foreground">{card.titleKh}</h3>
                            <p className="mt-1 mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">{card.descEn}</p>

                            {available ? (
                                <Button
                                    onClick={() => setActiveReport(card.reportKey)}
                                    className="w-full"
                                >
                                    {t('generate')}
                                </Button>
                            ) : (
                                <Button variant="outline" className="w-full" disabled>
                                    {t('generate')}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>

            {active && activeCard && (
                <ReportGenerateModal
                    isOpen={activeReport !== null}
                    onClose={() => setActiveReport(null)}
                    reportTitle={activeCard.titleKh}
                    events={cascadingData?.events ?? []}
                    organizations={cascadingData?.organizations ?? []}
                    isAdmin={isAdmin}
                    onGenerate={active.onGenerate}
                    isGenerating={active.isGenerating}
                    isDone={active.isDone}
                    onReset={active.onReset}
                />
            )}
        </>
    );
}
