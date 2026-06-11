import { TopOrganization } from '../types';
import { Building2, Medal } from 'lucide-react';
import { SectionHeader, Card } from '@/shared';
import { useTranslations } from 'next-intl';

interface TopOrgsTableProps {
    data: TopOrganization[];
}

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-amber-700'];

export function TopOrgsTable({ data }: TopOrgsTableProps) {
    const t = useTranslations('dashboard');
    const max = data.reduce((m, o) => Math.max(m, o.participants), 0) || 1;

    return (
        <Card className="flex flex-col h-full">
            <SectionHeader title={t('topOrganizations')} icon={Building2} subtitle="By participant count" />
            {data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-text">
                    {t('noOrganizationData')}
                </div>
            ) : (
                <div className="flex-1 p-5 pt-3 space-y-1">
                    {data.map((org, index) => (
                        <div
                            key={`${org.name}-${index}`}
                            className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-accent/40"
                        >
                            <div className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                index < 3
                                    ? "bg-primary-50 text-primary"
                                    : "bg-muted text-muted-foreground"
                            )}>
                                {index < 3 ? <Medal className={cn("h-4 w-4", RANK_COLORS[index])} /> : index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-heading">
                                    {org.name}
                                </p>
                                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                                        style={{ width: `${(org.participants / max) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-heading">
                                    {org.participants}
                                </p>
                                <p className="text-xs text-muted-text">
                                    participants
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

import { cn } from '@/shared/utils/cn';
