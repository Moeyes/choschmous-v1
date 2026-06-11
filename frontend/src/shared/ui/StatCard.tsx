'use client';

import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
        subtitle?: string;
    };
    color?: 'primary' | 'blue' | 'amber' | 'emerald' | 'purple' | 'error';
    className?: string;
    sparkline?: number[];
}

const ICON_BG = {
    primary: 'bg-primary text-primary-foreground',
    blue: 'bg-primary text-primary-foreground',
    amber: 'bg-warning text-warning-foreground',
    emerald: 'bg-success text-success-foreground',
    purple: 'bg-sidebar-accent text-sidebar-accent-foreground',
    error: 'bg-danger text-danger-foreground',
};

export function StatCard({
    label,
    value,
    icon: Icon,
    trend,
    color = 'primary',
    className,
}: StatCardProps) {
    const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-xl bg-card border border-border shadow-sm',
                'transition-all duration-200 hover:shadow-md hover:border-border/80',
                className
            )}
        >
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        ICON_BG[color]
                    )}>
                        <Icon className="h-5 w-5" />
                    </div>
                    {trend && (
                        <div className={cn(
                            'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-relaxed',
                            trend.isUp
                                ? 'bg-success-bg text-success'
                                : 'bg-danger-bg text-danger'
                        )}>
                            {trend.isUp
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />
                            }
                            <span>{trend.value}%</span>
                        </div>
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-2xl font-bold tracking-tight text-heading">
                        {formattedValue}
                    </p>
                    <p className="text-sm text-muted-text leading-relaxed">{label}</p>
                </div>
                {trend?.subtitle && (
                    <p className="mt-3 text-xs text-muted-text leading-relaxed">
                        {trend.subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}
