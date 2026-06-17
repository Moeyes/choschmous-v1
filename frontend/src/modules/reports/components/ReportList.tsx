'use client';

import { useState } from 'react';
import { useReportDownload } from '../hooks/useReportMutations';
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
import { useTranslations } from 'next-intl';
import { ReportGenerateModal } from './ReportGenerateModal';

interface ReportCard {
    id: string;
    key: string;
    titleKh: string;
    descEn: string;
    icon: LucideIcon;
    supportsSource?: boolean;
}

const REPORT_CARDS: ReportCard[] = [
    { id: 'RPT-1', key: 'sport-list', titleKh: '\u1785\u17CB\u1794\u17D2\u179A\u17B6\u1794\u17C1\u1791\u17B6\u1780\u17D2\u179F\u17B6', descEn: 'Sport registration list', icon: ClipboardList },
    { id: 'RPT-2', key: 'totals', titleKh: '\u1785\u17D2\u1793\u17C8\u1793\u17D2\u1781\u17BC\u1798', descEn: 'Total counts matrix', icon: LayoutGrid, supportsSource: true },
    { id: 'RPT-3', key: 'counts', titleKh: '\u1785\u17CB\u1785\u17D2\u1793\u17C8\u1793', descEn: 'Number per organization', icon: ListOrdered },
    { id: 'RPT-4', key: 'album', titleKh: '\u17A2\u17B6\u179B\u17CB\u1794\u17BB\u1798', descEn: 'Photo album with full details', icon: ImageIcon },
    { id: 'RPT-5', key: 'name-list', titleKh: '\u179A\u17B6\u1799\u1793\u17B6\u1798\u17BC\u1798', descEn: 'Combined roster', icon: Users },
    { id: 'RPT-6', key: 'leaders', titleKh: '\u1790\u17D2\u1793\u17B6\u1780\u17CA\u178A\u17D2\u1780\u1793\u17B6\u17C6\u1780\u17D2\u179A\u17C1\u1794\u17C0\u1794\u17D2\u179A\u17B6\u1794\u17C1\u1791\u17B6\u1780\u17D2\u179F\u17B6', descEn: 'Leadership all sports', icon: Award },
    { id: 'RPT-7', key: 'coach-athlete', titleKh: '\u1782\u17D2\u179A\u17BC\u1794\u1780\u17D2\u1793\u17C0\u1780 \u17A2\u178F\u17D2\u178F\u1796\u179B\u17B7\u1780', descEn: 'Coaches and athletes', icon: Dumbbell },
    { id: 'RPT-8', key: 'delegation', titleKh: '\u1794\u17D2\u179A\u17B6\u178F\u17D2\u1797\u17BC \u17A2\u17D2\u1793\u17B6\u1794\u1780\u17D2\u178F\u17D2\u1793\u17B6\u17C6', descEn: 'Delegates and leaders', icon: UserCog },
];

export function ReportList() {
    const { can } = usePermissions();
    const t = useTranslations('reports');
    const download = useReportDownload();
    const { data: cascadingData, isLoading } = useCascadingData();
    const [activeCard, setActiveCard] = useState<ReportCard | null>(null);
    const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {REPORT_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.id}
                            className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <Badge variant="success" size="sm">{t('statusAvailable')}</Badge>
                            </div>
                            <h3 className="text-base font-semibold leading-relaxed text-foreground">{card.titleKh}</h3>
                            <p className="mt-1 mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">{card.descEn}</p>
                            <Button onClick={() => setActiveCard(card)} className="w-full">
                                {t('generate')}
                            </Button>
                        </div>
                    );
                })}
            </div>

            {activeCard && (
                <ReportGenerateModal
                    isOpen={!!activeCard}
                    onClose={() => { setActiveCard(null); download.reset(); }}
                    reportKey={activeCard.key}
                    reportTitle={activeCard.titleKh}
                    supportsSource={activeCard.supportsSource}
                    events={cascadingData?.events ?? []}
                    organizations={cascadingData?.organizations ?? []}
                    isAdmin={isAdmin}
                    onGenerate={(params) => download.mutate({ key: activeCard.key, ...params })}
                    isGenerating={download.isPending}
                    isDone={download.isSuccess}
                    onReset={() => download.reset()}
                />
            )}
        </>
    );
}
