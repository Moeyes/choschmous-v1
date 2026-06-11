import { cn } from '@/shared/utils/cn';

interface PageLoadingStateProps {
    label?: string;
    className?: string;
}

export function PageLoadingState({
    label = 'Loading Content...',
    className,
}: PageLoadingStateProps) {
    return (
        <div className={cn('flex min-h-[400px] flex-col items-center justify-center gap-6 p-12', className)}>
            <div className="relative">
                <div className="h-12 w-12 rounded-full border-[3px] border-primary-100 border-t-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-text animate-pulse-soft">{label}</p>
        </div>
    );
}
