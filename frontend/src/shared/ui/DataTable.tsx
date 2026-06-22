"use client";

import React, { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";
import { Skeleton } from "@/shared/ui/Skeleton";

export interface DataTableColumn<T> {
  header: string;
  accessor: keyof T | ((item: T, index: number) => ReactNode);
  className?: string;
  align?: "left" | "center" | "right";
  hideOnMobile?: boolean;
  /** Label to show before value in card mode on mobile */
  mobileLabel?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  emptyState?: ReactNode;
  className?: string;
  isLoading?: boolean;
  isFetching?: boolean;
  minWidth?: string;
  skeletonRows?: number;
  /** Render as cards on mobile */
  cardMode?: boolean;
}

export const DataTable = React.memo(function DataTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  emptyState,
  className,
  isLoading,
  isFetching,
  minWidth = "min-w-[800px]",
  skeletonRows = 5,
  cardMode = true,
}: DataTableProps<T>) {
  const renderCell = (item: T, col: DataTableColumn<T>, index: number): ReactNode => {
    return typeof col.accessor === "function"
      ? col.accessor(item, index)
      : (item[col.accessor] as ReactNode);
  };

  return (
    <div
      className={cn(
        "w-full",
        isFetching && "opacity-60 pointer-events-none transition-opacity duration-150",
        className
      )}
    >
      {/* Desktop table */}
      <div className="hidden sm:block w-full overflow-x-auto">
        <table className={cn("w-full text-left border-collapse", minWidth)}>
          <thead>
            <tr className="border-b border-border">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-5 py-3.5 text-xs font-semibold text-muted-text/70 uppercase tracking-wider leading-relaxed",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
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
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-sm text-muted-text">
                  {emptyState}
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr
                  // Index guards against business ids that legitimately repeat
                  // across rows (e.g. one person with multiple participations).
                  key={`${rowKey(item)}-${i}`}
                  onClick={() => onRowClick?.(item)}
                  {...(onRowClick
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(item);
                          }
                        },
                      }
                    : {})}
                  className={cn(
                    "transition-colors duration-150",
                    onRowClick ? "cursor-pointer hover:bg-accent/40" : "hover:bg-accent/20"
                  )}
                >
                  {columns.map((col, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-5 py-4 text-sm text-body leading-relaxed",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
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
                  <Skeleton key={j} className="h-4 w-3/4" />
                ))}
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-text bg-card rounded-xl border border-border">
              {emptyState}
            </div>
          ) : (
            data.map((item, i) => (
              <div
                // Index guards against business ids that legitimately repeat
                // across rows (e.g. one person with multiple participations).
                key={`${rowKey(item)}-${i}`}
                onClick={() => onRowClick?.(item)}
                {...(onRowClick
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(item);
                        }
                      },
                    }
                  : {})}
                className={cn(
                  "bg-card rounded-xl border border-border p-4 space-y-2.5 transition-all duration-150",
                  onRowClick && "cursor-pointer active:scale-[0.99] hover:border-border/80"
                )}
              >
                {columns.filter((col) => !col.hideOnMobile).map((col, j) => (
                  <div key={j} className="flex items-center justify-between">
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
