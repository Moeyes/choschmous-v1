import { ReactNode } from 'react';
import { PageShell } from '@/shared/layout/PageShell';

interface PageNotFoundProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function PageNotFound({ title, description, action }: PageNotFoundProps) {
    return (
        <PageShell padded={false} size="wide">
            <div className="py-20 text-center flex flex-col items-center gap-6">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-lg bg-accent">
                    <span className="text-4xl font-semibold text-primary/30">404</span>
                </div>
                <div>
                    <h1 className="text-2xl font-semibold leading-snug text-foreground">{title}</h1>
                    {description && <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-muted-foreground">{description}</p>}
                </div>
                {action && <div className="mt-2">{action}</div>}
            </div>
        </PageShell>
    );
}
