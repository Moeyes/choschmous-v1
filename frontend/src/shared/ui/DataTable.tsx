'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface DataTableColumn<T> {
    header: string;
    accessor: keyof T | ((item: T, index: number) => ReactNode);
    className?: string;
    align?: 'left' | 'center' | 'right';
    hideOnMobile?: boolean;
    /** Label to show before value in card mode on mobile */
    mobileLabel?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
    className?: string;
    isLoading?: boolean;
    minWidth?: string;
    skeletonRows?: number;
    /** Render as cards on mobile */
    cardMode?: boolean;
}

export const DataTable = React.memo(function DataTable<T>({
    data,
    columns,
    onRowClick,
    emptyMessage = 'No data available',
    className,
    isLoading,
    minWidth = 'min-w-[800px]',
    skeletonRows = 5,
    cardMode = true,
}: DataTableProps<T>) {
    const renderCell = (item: T, col: DataTableColumn<T>, index: number): ReactNode => {
        return typeof col.accessor === 'function'
            ? col.accessor(item, index)
            : (item[col.accessor] as ReactNode);
    };

    return (
        <div className={cn('w-full', className)}>
            {/* Desktop table */}
            <div className="hidden sm:block w-full overflow-x-auto">
                <table className={cn('w-full text-left border-collapse', minWidth)}>
                    <thead>
                        <tr className="border-b border-border">
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    className={cn(
                                        'px-5 py-3.5 text-xs font-semibold text-muted-text/70 uppercase tracking-wider leading-relaxed',
                                        col.align === 'right' && 'text-right',
                                        col.align === 'center' && 'text-center',
                                        col.className
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            Array.from({ length: skeletonRows }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {columns.map((_, j) => (
                                        <td key={j} className="px-5 py-4">
                                            <div className="h-4 bg-muted rounded-md w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="p-12 text-center text-sm text-muted-text">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, i) => (
                                <tr
                                    key={i}
                                    onClick={() => onRowClick?.(item)}
                                    className={cn(
                                        'transition-colors duration-150',
                                        onRowClick ? 'cursor-pointer hover:bg-accent/40' : 'hover:bg-accent/20'
                                    )}
                                >
                                    {columns.map((col, j) => (
                                        <td
                                            key={j}
                                            className={cn(
                                                'px-5 py-4 text-sm text-body leading-relaxed',
                                                col.align === 'right' && 'text-right',
                                                col.align === 'center' && 'text-center',
                                                col.className
                                            )}
                                        >
                                            {renderCell(item, col, i)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile card list */}
            {cardMode && (
                <div className="sm:hidden space-y-3">
                    {isLoading ? (
                        Array.from({ length: skeletonRows }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-card rounded-xl border border-border p-4 space-y-3">
                                {columns.map((_, j) => (
                                    <div key={j} className="h-4 bg-muted rounded-md w-3/4" />
                                ))}
                            </div>
                        ))
                    ) : data.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-text bg-card rounded-xl border border-border">
                            {emptyMessage}
                        </div>
                    ) : (
                        data.map((item, i) => (
                            <div
                                key={i}
                                onClick={() => onRowClick?.(item)}
                                className={cn(
                                    'bg-card rounded-xl border border-border p-4 space-y-2.5 transition-all duration-150',
                                    onRowClick && 'cursor-pointer active:scale-[0.99] hover:border-border/80'
                                )}
                            >
                                {columns.map((col, j) => (
                                    <div key={j} className={cn(
                                        'flex items-center justify-between',
                                        col.hideOnMobile && 'hidden'
                                    )}>
                                        <span className="text-xs font-medium text-muted-text uppercase tracking-wider">
                                            {col.mobileLabel || col.header}
                                        </span>
                                        <span className="text-sm text-body text-right">
                                            {renderCell(item, col, i)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}) as <T,>(props: DataTableProps<T>) => ReactNode;
