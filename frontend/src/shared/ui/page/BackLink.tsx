import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface BackLinkProps {
    href: string;
    label: string;
    className?: string;
}

export function BackLink({ href, label, className }: BackLinkProps) {
    return (
        <Link
            href={href}
            className={cn(
                'flex w-fit items-center gap-1.5 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-primary',
                className
            )}
        >
            <ChevronLeft className="h-4 w-4" />
            {label}
        </Link>
    );
}
