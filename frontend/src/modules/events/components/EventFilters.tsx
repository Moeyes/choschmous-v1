"use client";

import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import { useTranslations } from "next-intl";

interface EventFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: "all" | "upcoming" | "ongoing" | "completed";
  onStatusFilterChange: (value: "all" | "upcoming" | "ongoing" | "completed") => void;
}

export function EventFilters({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
}: EventFiltersProps) {
  const t = useTranslations("events");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <Input
          placeholder={t("search") as string}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
        />
      </div>
      <div className="w-full sm:w-48">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            onStatusFilterChange(
              v as "all" | "upcoming" | "ongoing" | "completed",
            );
          }}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>{t(`statusFilter.${statusFilter}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("statusFilter.all")}</SelectItem>
            <SelectItem value="upcoming">
              {t("statusFilter.upcoming")}
            </SelectItem>
            <SelectItem value="ongoing">
              {t("statusFilter.ongoing")}
            </SelectItem>
            <SelectItem value="completed">
              {t("statusFilter.completed")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
