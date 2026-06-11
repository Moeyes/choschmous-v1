import React from 'react';
import { cn } from '@/shared/utils/cn';

interface BadgeProps {
    children?: React.ReactNode;
    variant?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'flagged' | 'revision_requested' | 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline';
    size?: 'xs' | 'sm' | 'md';
    className?: string;
    dot?: boolean;
}

const VARIANT_MAP = {
    draft: 'bg-muted text-muted-foreground',
    submitted: 'bg-accent text-accent-foreground',
    approved: 'bg-success-bg text-success',
    rejected: 'bg-danger-bg text-danger',
    flagged: 'bg-warning-bg text-warning',
    revision_requested: 'bg-warning-bg text-warning',
    primary: 'bg-primary text-primary-foreground',
    default: 'bg-primary-50 text-primary',
    secondary: 'bg-accent text-accent-foreground',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    error: 'bg-danger-bg text-danger',
    info: 'bg-info-bg text-info',
    outline: 'bg-transparent text-foreground border border-border',
};

const DOT_COLORS: Record<string, string> = {
    draft: 'bg-muted-foreground',
    submitted: 'bg-accent-foreground',
    approved: 'bg-success',
    rejected: 'bg-danger',
    flagged: 'bg-warning',
    revision_requested: 'bg-warning',
    primary: 'bg-primary',
    default: 'bg-primary',
    secondary: 'bg-accent-foreground',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-danger',
    info: 'bg-info',
    outline: 'bg-foreground',
};

const SIZE_MAP = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
};

export function Badge({
    children,
    variant = 'default',
    size = 'sm',
    className,
    dot,
}: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-transparent font-medium leading-relaxed',
                VARIANT_MAP[variant],
                SIZE_MAP[size],
                className
            )}
        >
            {dot && (
                <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[variant])} />
            )}
            {children}
        </span>
    );
}
