import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
    border?: boolean;
    size?: 'sm' | 'md';
}

export function SectionHeader({
    title,
    subtitle,
    icon: Icon,
    action,
    className,
    border = true,
    size = 'md',
}: SectionHeaderProps) {
    return (
        <div className={cn(
            'flex items-center justify-between px-6 py-4',
            border && 'border-b border-border',
            className
        )}>
            <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                )}
                <div className="min-w-0">
                    <h3 className={cn(
                        'font-semibold text-heading leading-snug tracking-tight',
                        size === 'sm' ? 'text-sm' : 'text-sm'
                    )}>
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-xs text-muted-text leading-relaxed mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
    );
}
