"use client";

import { EventType } from "../types";
import { Badge } from "@/shared";
import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";

export function TypeBadge({ type }: { type: EventType }) {
  const t = useTranslations("events.types");
  const config: Record<
    string,
    {
      label: string;
      variant: "default" | "info" | "warning" | "success" | "secondary";
    }
  > = {
    [EventType.NATIONAL]: { label: t("NATIONAL"), variant: "default" },
    [EventType.UNIVERSITY]: { label: t("UNIVERSITY"), variant: "info" },
    [EventType.HIGH_SCHOOL]: { label: t("HIGH_SCHOOL"), variant: "warning" },
    [EventType.PRIMARY_SCHOOL]: {
      label: t("PRIMARY_SCHOOL"),
      variant: "success",
    },
  };
  const matched = config[type];
  const label = matched ? matched.label : (type ?? "Unknown");
  const variant = matched ? matched.variant : "secondary";
  return (
    <Badge variant={variant} className="gap-1.5 whitespace-nowrap">
      <Tag className="h-3 w-3" />
      <span>{label}</span>
    </Badge>
  );
}
