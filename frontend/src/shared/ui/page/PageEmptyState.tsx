import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface PageEmptyStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
}

export function PageEmptyState({
    title,
    description,
    icon: Icon,
    action,
    className,
}: PageEmptyStateProps) {
    return (
        <div className={cn('rounded-lg border border-dashed border-border bg-card p-16 text-center', className)}>
            <div className="flex flex-col items-center gap-4">
                {Icon && (
                    <div className="rounded-lg bg-accent p-4">
                        <Icon className="h-8 w-8 text-primary" />
                    </div>
                )}
                <div className="space-y-1.5">
                    <h3 className="text-lg font-semibold leading-snug text-foreground">{title}</h3>
                    {description && (
                        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
                    )}
                </div>
                {action && <div className="mt-2">{action}</div>}
            </div>
        </div>
    );
}
