'use client';

import { useState } from 'react';
import { Calendar, Building2, CheckCircle2, Download, FileSpreadsheet, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
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
    reportKey: string;
    reportTitle: string;
    supportsSource?: boolean;
    events: RefItem[];
    organizations: RefItem[];
    isAdmin: boolean;
    onGenerate: (params: { event_id: number; org_id?: number; source?: 'planned' | 'actual'; format: 'xlsx' | 'pdf' }) => void;
    isGenerating: boolean;
    isDone: boolean;
    onReset: () => void;
}

export function ReportGenerateModal({
    isOpen,
    onClose,
    reportTitle,
    supportsSource,
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
    const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx');
    const [source, setSource] = useState<'planned' | 'actual'>('planned');

    const handleClose = () => {
        onReset();
        setEventId('');
        setOrgId('');
        setFormat('xlsx');
        setSource('planned');
        onClose();
    };

    const handleGenerate = () => {
        if (!eventId) return;
        onGenerate({
            event_id: Number(eventId),
            ...(isAdmin && orgId ? { org_id: Number(orgId) } : {}),
            ...(supportsSource ? { source } : {}),
            format,
        });
    };

    const renderSuccessFooter = (
        <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
                {tCommon('close')}
            </Button>
            <Button className="flex-1 gap-2" onClick={handleGenerate}>
                <Download className="h-4 w-4" />
                {t('downloadAgain')}
            </Button>
        </div>
    );

    const renderFormFooter = (
        <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
                {tCommon('close')}
            </Button>
            <Button
                className="flex-1 gap-2"
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!eventId || isGenerating}
            >
                {!isGenerating && <Download className="h-4 w-4" />}
                {isGenerating ? t('generating') : t('generate')}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={reportTitle}
            size="md"
            footer={isDone ? renderSuccessFooter : renderFormFooter}
        >
            {isDone ? (
                <div className="flex flex-col items-center gap-5 py-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                        <CheckCircle2 className="h-9 w-9 text-success" />
                    </div>
                    <div>
                        <p className="text-base font-semibold leading-snug text-foreground">{t('generated')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t('generatedDesc')}</p>
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
                            <button
                                type="button"
                                onClick={() => setFormat('xlsx')}
                                className={cn(
                                    'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium leading-relaxed transition-colors',
                                    format === 'xlsx'
                                        ? 'border-primary bg-accent text-primary'
                                        : 'border-border text-muted-foreground hover:bg-accent',
                                )}
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                {t('formatExcel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('pdf')}
                                className={cn(
                                    'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium leading-relaxed transition-colors',
                                    format === 'pdf'
                                        ? 'border-primary bg-accent text-primary'
                                        : 'border-border text-muted-foreground hover:bg-accent',
                                )}
                            >
                                <FileText className="h-4 w-4" />
                                {t('formatPdf')}
                            </button>
                        </div>
                    </div>

                    {supportsSource && (
                        <div className="space-y-1.5">
                            <span className="block text-sm font-medium text-foreground">{t('selectSource')}</span>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSource('planned')}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium leading-relaxed transition-colors',
                                        source === 'planned'
                                            ? 'border-primary bg-accent text-primary'
                                            : 'border-border text-muted-foreground hover:bg-accent',
                                    )}
                                >
                                    {source === 'planned' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                    {t('sourcePlanned')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSource('actual')}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium leading-relaxed transition-colors',
                                        source === 'actual'
                                            ? 'border-primary bg-accent text-primary'
                                            : 'border-border text-muted-foreground hover:bg-accent',
                                    )}
                                >
                                    {source === 'actual' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                    {t('sourceActual')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
