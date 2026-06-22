"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui/button";

export interface PaginationState {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: PaginationState) {
  const t = useTranslations("common");

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between border-t border-border bg-secondary/5 px-5 py-3">
      <p className="text-xs font-medium text-muted-text">
        {t("showing")}{" "}
        <span className="font-semibold text-heading">{from}</span>{" "}
        {t("to")}{" "}
        <span className="font-semibold text-heading">{to}</span>{" "}
        {t("of")}{" "}
        <span className="font-semibold text-heading">{totalCount}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
