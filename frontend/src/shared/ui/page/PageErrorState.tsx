import { ReactNode } from 'react';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface PageErrorStateProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
}

export function PageErrorState({
    title,
    description,
    icon: Icon = AlertCircle,
    action,
    className,
}: PageErrorStateProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-danger/20 bg-danger-bg p-12 text-center',
                className,
            )}
        >
            <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-danger/10 p-3 text-danger">
                    <Icon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                    <p className="font-semibold text-danger leading-snug">{title}</p>
                    {description && (
                        <p className="mx-auto max-w-sm text-sm text-muted-text leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
                {action && <div className="mt-2">{action}</div>}
            </div>
        </div>
    );
}
