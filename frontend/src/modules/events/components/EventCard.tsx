"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Calendar, MapPin, Eye, Edit2, Trash2 } from "lucide-react";
import { Event } from "../types";
import { Badge } from "@/shared";
import { Button } from "@/shared/ui/button";
import { TypeBadge } from "./EventTypeBadge";
import { EventPhaseBadges } from "./EventPhases";

type Status = "upcoming" | "ongoing" | "completed";

function statusOf(event: Event): Status {
  const now = new Date();
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "ongoing";
  return "completed";
}

// Inactive/past states stay quiet (draft = muted); only the live state pops.
const STATUS_VARIANT: Record<Status, "info" | "success" | "draft"> = {
  upcoming: "info",
  ongoing: "success",
  completed: "draft",
};

/**
 * Card representation of an event, used below `lg` where the list table is too
 * wide to read. Mirrors the table columns top-to-bottom so the page reads
 * naturally on phones and tablets.
 */
export function EventCard({
  event,
  isAdmin,
  onEdit,
  onDelete,
}: {
  event: Event;
  isAdmin: boolean;
  onEdit: (event: Event) => void;
  onDelete: (id: number) => void;
}) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const status = statusOf(event);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/events/${event.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-snug text-foreground">
            {event.name}
          </h3>
          {event.description && (
            <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          )}
        </Link>
        <Badge
          variant={STATUS_VARIANT[status]}
          className="shrink-0 whitespace-nowrap"
        >
          {t(`statusFilter.${status}`)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          {event.start_date} {tCommon("to")} {event.end_date}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary/60" />
          {event.location || "N/A"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <TypeBadge type={event.event_type} />
      </div>

      <div className="mt-3">
        <EventPhaseBadges event={event} compact />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Link href={`/events/${event.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5">
            <Eye className="h-4 w-4" />
            {tCommon("view")}
          </Button>
        </Link>
        {isAdmin && (
          <>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onEdit(event)}
              aria-label={tCommon("edit")}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onDelete(event.id)}
              aria-label={tCommon("delete")}
              className="text-error hover:bg-error/5 hover:text-error"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
