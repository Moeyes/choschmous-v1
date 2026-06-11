"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Pencil,
  Tag,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Badge,
  DetailHeader,
  PageLoadingState,
  PageNotFound,
  PageShell,
  Modal,
} from "@/shared";
import { useAuth, UserRole } from "@/core/auth";
import { useUpdateEvent } from "../hooks";
import { useEventDetail, useEventSports } from "../hooks";
import { EventUpdate } from "../types";
import { EventForm } from "./EventForm";
import { EventDetailPanels } from "./EventDetailPanels";
import { useTranslations } from "next-intl";

interface EventDetailPageProps {
  eventId: number;
}

export function EventDetailPage({ eventId }: EventDetailPageProps) {
  const { data: event, isLoading } = useEventDetail(eventId);
  const { data: eventSports } = useEventSports(eventId);
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { role } = useAuth();
  const canManage =
    role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  const { mutate: publishEvent } = useUpdateEvent();
  const t = useTranslations("events");
  const tCommon = useTranslations("common");

  const getStatus = (start: string, end: string) => {
    const now = new Date();
    if (now < new Date(start)) return "upcoming" as const;
    if (now <= new Date(end)) return "ongoing" as const;
    return "completed" as const;
  };

  if (isLoading) return <PageLoadingState />;
  if (!event)
    return (
      <PageNotFound
        title={t("failedToLoad")}
        action={
          <Link href="/events" className="text-primary hover:underline">
            {t("backToEvents")}
          </Link>
        }
      />
    );

  return (
    <>
      <PageShell padded={false} size="wide">
        <DetailHeader
          backHref="/events"
          backLabel={t("backToEvents")}
          eyebrow={event.event_type}
          eyebrowIcon={Tag}
          title={event.name}
          meta={
            <div className="flex flex-wrap items-center gap-4">
              <Badge
                variant={
                  getStatus(event.start_date, event.end_date) === "upcoming"
                    ? "info"
                    : getStatus(event.start_date, event.end_date) === "ongoing"
                      ? "success"
                      : "secondary"
                }
              >
                {t(`statusFilter.${getStatus(event.start_date, event.end_date)}`)}
              </Badge>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {event.start_date} {tCommon("to")} {event.end_date}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" />
                {t("register")}:{" "}
                {event.registration_is_open
                  ? t("phases.open")
                  : t("phases.closed")}
              </span>
            </div>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <Button
                  onClick={() => {
                    const payload = {
                      id: event.id,
                      status: "published",
                    } as unknown as EventUpdate & { status?: string };
                    publishEvent(payload);
                  }}
                  variant="secondary"
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("publish")}
                </Button>
              )}
              {canManage && (
                <Button onClick={() => setIsEditOpen(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  {t("editEvent")}
                </Button>
              )}
              <Link href="/dashboard">
                <Button variant="outline" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  {tCommon("dashboard")}
                </Button>
              </Link>
            </div>
          }
        />
        <EventDetailPanels
          event={event}
          eventId={eventId}
          eventSports={eventSports}
          selectedSportId={selectedSportId}
          onSelectSport={setSelectedSportId}
          canManage={canManage}
        />
      </PageShell>
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t("editEvent")}
      >
        <EventForm
          event={event}
          onSuccess={() => setIsEditOpen(false)}
          onCancel={() => setIsEditOpen(false)}
        />
      </Modal>
    </>
  );
}
