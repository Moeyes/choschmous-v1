"use client";

import { useTranslations } from "next-intl";
import { FilterToolbar } from "@/shared/ui/layout";

type EventStatus = "all" | "upcoming" | "ongoing" | "completed";

interface EventFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: EventStatus;
  onStatusFilterChange: (value: EventStatus) => void;
}

export function EventFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
}: EventFiltersProps) {
  const t = useTranslations("events");

  return (
    <FilterToolbar
      search={{
        value: query,
        onChange: onQueryChange,
        placeholder: t("search"),
      }}
      filters={[
        {
          key: "status",
          value: statusFilter,
          onChange: (value) => onStatusFilterChange(value as EventStatus),
          options: [
            { value: "all", label: t("statusFilter.all") },
            { value: "upcoming", label: t("statusFilter.upcoming") },
            { value: "ongoing", label: t("statusFilter.ongoing") },
            { value: "completed", label: t("statusFilter.completed") },
          ],
        },
      ]}
      onClear={() => {
        onQueryChange("");
        onStatusFilterChange("all");
      }}
    />
  );
}
