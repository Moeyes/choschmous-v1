'use client';

import { FileText, Send, CheckCircle2, XCircle, Flag, RotateCcw, Clock, Check, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/utils/cn';
import type { ParticipationStatus } from '../types';

interface StatusTimelineProps {
    status: ParticipationStatus;
}

type Tone = 'primary' | 'success' | 'destructive' | 'warning' | 'muted';

const DECISION_META: Record<string, { icon: LucideIcon; tone: Tone }> = {
    APPROVED: { icon: CheckCircle2, tone: 'success' },
    REJECTED: { icon: XCircle, tone: 'destructive' },
    FLAGGED: { icon: Flag, tone: 'warning' },
    REVISION_REQUESTED: { icon: RotateCcw, tone: 'warning' },
};

const TONE_NODE: Record<Tone, string> = {
    primary: 'bg-primary text-primary-foreground border-primary',
    success: 'bg-success text-white border-success',
    destructive: 'bg-destructive text-destructive-foreground border-destructive',
    warning: 'bg-warning text-warning-foreground border-warning',
    muted: 'bg-card text-muted-foreground border-border',
};

const TONE_LABEL: Record<Tone, string> = {
    primary: 'text-primary',
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
};

/**
 * Horizontal FSM stepper: DRAFT → SUBMITTED → decision.
 * The third node reflects the actual terminal status once reached.
 */
export function StatusTimeline({ status }: StatusTimelineProps) {
    const t = useTranslations('participation.statuses');

    const isDecision = status in DECISION_META;
    const currentIndex = status === 'DRAFT' ? 0 : status === 'SUBMITTED' ? 1 : 2;

    const decision = DECISION_META[status];
    const decisionIcon = decision?.icon ?? Clock;
    const decisionTone: Tone = decision?.tone ?? 'muted';
    const decisionLabel = isDecision ? t(status) : t('APPROVED');

    const steps = [
        { key: 'DRAFT', label: t('DRAFT'), icon: FileText },
        { key: 'SUBMITTED', label: t('SUBMITTED'), icon: Send },
        { key: 'decision', label: decisionLabel, icon: decisionIcon },
    ];

    const nodeTone = (index: number): Tone => {
        if (index < currentIndex) return 'primary'; // completed
        if (index === currentIndex) {
            return index === 2 ? decisionTone : 'primary';
        }
        return 'muted'; // future
    };

    return (
        <div className="flex items-start">
            {steps.map((step, index) => {
                const tone = nodeTone(index);
                const Icon = step.icon;
                const completed = index < currentIndex;
                const lineActive = index < currentIndex;
                return (
                    <div key={step.key} className="flex flex-1 items-start last:flex-none">
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
                                    TONE_NODE[tone],
                                )}
                            >
                                {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <span className={cn('mt-2 max-w-24 text-center text-xs leading-relaxed', TONE_LABEL[tone])}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="mt-5 h-0.5 flex-1 rounded-full bg-border">
                                <div className={cn('h-full rounded-full', lineActive ? 'bg-primary' : 'bg-transparent')} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
