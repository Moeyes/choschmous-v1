'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/utils/cn';
import { DataTable } from '@/shared/ui/DataTable';
import { PageHeader } from '@/shared/ui/page/PageHeader';
import { PageErrorState } from '@/shared/ui/page/PageErrorState';
import type { DataTableColumn } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import type { PaginationState } from '@/shared/ui/Pagination';

interface ListPageProps<T> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;

  data: T[];
  columns: DataTableColumn<T>[];
  isLoading?: boolean;
  isFetching?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string | number;

  error?: Error | null;
  errorTitle?: string;
  errorMessage?: string;

  pagination?: PaginationState;

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
  isFetching,
  emptyState,
  onRowClick,
  rowKey,
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
            isFetching={isFetching}
            data={data}
            columns={columns}
            onRowClick={onRowClick}
            rowKey={rowKey}
            emptyState={emptyState ?? <p className="text-sm text-muted-text">{tCommon("noData")}</p>}
          />

          {pagination && <Pagination {...pagination} />}
        </div>
      )}
    </div>
  );
}
