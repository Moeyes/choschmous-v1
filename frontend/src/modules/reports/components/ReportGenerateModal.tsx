'use client';

import { useState } from 'react';
import { Calendar, Building2, CheckCircle2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { useTranslations } from 'next-intl';

interface RefItem {
    id: number;
    name_kh?: string | null;
    name_en?: string | null;
}

interface ReportGenerateModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportTitle: string;
    events: RefItem[];
    organizations: RefItem[];
    isAdmin: boolean;
    /** Calls the existing download mutation. Logic lives in useReportMutations. */
    onGenerate: (params: { event_id: number; organization_id?: number }) => void;
    isGenerating: boolean;
    isDone: boolean;
    onReset: () => void;
}

export function ReportGenerateModal({
    isOpen,
    onClose,
    reportTitle,
    events,
    organizations,
    isAdmin,
    onGenerate,
    isGenerating,
    isDone,
    onReset,
}: ReportGenerateModalProps) {
    const t = useTranslations('reports');
    const tCommon = useTranslations('common');
    const [eventId, setEventId] = useState('');
    const [orgId, setOrgId] = useState('');

    const handleClose = () => {
        onReset();
        setEventId('');
        setOrgId('');
        onClose();
    };

    const buildParams = () => ({
        event_id: Number(eventId),
        organization_id: isAdmin && orgId ? Number(orgId) : undefined,
    });

    const handleGenerate = () => {
        if (!eventId) return;
        onGenerate(buildParams());
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={reportTitle}>
            {isDone ? (
                <div className="flex flex-col items-center gap-5 py-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                        <CheckCircle2 className="h-9 w-9 text-success" />
                    </div>
                    <div>
                        <p className="text-base font-semibold leading-snug text-foreground">{t('generated')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('generatedDesc')}</p>
                    </div>
                    <div className="flex w-full gap-3">
                        <Button variant="outline" className="flex-1" onClick={handleClose}>
                            {tCommon('close')}
                        </Button>
                        <Button className="flex-1 gap-2" onClick={handleGenerate}>
                            <Download className="h-4 w-4" />
                            {t('downloadAgain')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {t('selectEvent')}
                        </label>
                        <select
                            value={eventId}
                            onChange={(e) => setEventId(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring"
                        >
                            <option value="">{t('chooseEvent')}</option>
                            {events.map((e) => (
                                <option key={e.id} value={e.id}>{e.name_kh || e.name_en}</option>
                            ))}
                        </select>
                    </div>

                    {isAdmin && (
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                {t('selectOrganization')}
                            </label>
                            <select
                                value={orgId}
                                onChange={(e) => setOrgId(e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-ring"
                            >
                                <option value="">{t('allOrganizations')}</option>
                                {organizations.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name_kh || o.name_en}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <span className="block text-sm font-medium text-foreground">{t('selectFormat')}</span>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 rounded-md border border-primary bg-accent px-3 py-2.5">
                                <FileSpreadsheet className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium leading-relaxed text-primary">{t('formatExcel')}</span>
                            </div>
                            <div
                                className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 opacity-60"
                                title={t('pdfComingSoon')}
                            >
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm leading-relaxed text-muted-foreground">{t('formatPdf')}</span>
                            </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{t('pdfComingSoon')}</p>
                    </div>

                    <div className="flex gap-3 border-t border-border pt-4">
                        <Button variant="outline" className="flex-1" onClick={handleClose}>
                            {tCommon('close')}
                        </Button>
                        <Button
                            className={cn('flex-1 gap-2')}
                            onClick={handleGenerate}
                            loading={isGenerating}
                            disabled={!eventId || isGenerating}
                        >
                            {!isGenerating && <Download className="h-4 w-4" />}
                            {isGenerating ? t('generating') : t('generate')}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
