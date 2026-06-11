'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/utils/cn';
import { DataTable } from '@/shared/ui/DataTable';
import { PageHeader } from '@/shared/ui/page/PageHeader';
import { PageErrorState } from '@/shared/ui/page/PageErrorState';
import type { DataTableColumn } from '@/shared/ui/DataTable';
import { Button } from '@/shared/ui/button';

interface PaginationInfo {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

interface ListPageProps<T> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;

  data: T[];
  columns: DataTableColumn<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;

  error?: Error | null;
  errorTitle?: string;
  errorMessage?: string;

  pagination?: PaginationInfo;

  className?: string;
}

export function ListPage<T>({
  title,
  description,
  icon,
  action,
  children,
  data,
  columns,
  isLoading,
  emptyMessage,
  onRowClick,
  error,
  errorTitle,
  errorMessage,
  pagination,
  className,
}: ListPageProps<T>) {
  const tCommon = useTranslations('common');

  return (
    <div className={cn('space-y-6', className)}>
      <PageHeader title={title} description={description} icon={icon} action={action} />

      {children}

      {error ? (
        <PageErrorState
          title={errorTitle || tCommon('error')}
          description={errorMessage || error.message || tCommon('connectionError')}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <DataTable
            isLoading={isLoading}
            data={data}
            columns={columns}
            onRowClick={onRowClick}
            emptyMessage={emptyMessage || tCommon('noData')}
          />

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border bg-secondary/5 px-5 py-3">
              <p className="text-xs text-muted-text font-medium">
                {tCommon('showing')}{' '}
                <span className="text-heading font-semibold">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{' '}
                {tCommon('to')}{' '}
                <span className="text-heading font-semibold">
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
                </span>{' '}
                {tCommon('of')}{' '}
                <span className="text-heading font-semibold">{pagination.totalCount}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {tCommon('previous')}
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                >
                  {tCommon('next')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
