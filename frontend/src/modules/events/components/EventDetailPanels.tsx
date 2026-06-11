"use client";

import { Trophy } from "lucide-react";
import { ContentPanel, PageEmptyState } from "@/shared";
import { useUpdateEventPhase } from "../hooks";
import { Event } from "../types";
import { EventSportManager } from "./EventSportManager";
import { EventSportOrgManager } from "./EventSportOrgManager";
import { EventPhaseControl } from "./EventPhases";
import { useTranslations } from "next-intl";

interface EventDetailPanelsProps {
  event: Event;
  eventId: number;
  eventSports?: { sports_id: number; name_kh: string }[];
  selectedSportId: number | null;
  onSelectSport: (id: number | null) => void;
  canManage: boolean;
}

export function EventDetailPanels({
  event,
  eventId,
  eventSports,
  selectedSportId,
  onSelectSport,
  canManage,
}: EventDetailPanelsProps) {
  const { mutate: updatePhase } = useUpdateEventPhase();
  const t = useTranslations("events");

  const selectedSportName =
    eventSports?.find((s) => s.sports_id === selectedSportId)?.name_kh || "";

  return (
    <div className="grid grid-cols-1 gap-8">
      <ContentPanel>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("phases.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("phases.hint")}
          </p>
        </div>
        <EventPhaseControl
          event={event}
          canManage={canManage}
          onChange={(phase, status) =>
            updatePhase({ id: event.id, phase, status })
          }
        />
      </ContentPanel>
      <ContentPanel>
        <EventSportManager
          eventId={eventId}
          onSelectSport={onSelectSport}
          selectedSportId={selectedSportId}
        />
      </ContentPanel>
      {selectedSportId ? (
        <ContentPanel className="min-h-100">
          <EventSportOrgManager
            eventId={eventId}
            sportId={selectedSportId}
            sportName={selectedSportName}
          />
        </ContentPanel>
      ) : (
        <PageEmptyState
          icon={Trophy}
          title={t("sports.title")}
          description={t("sports.noSportsAssigned")}
        />
      )}
    </div>
  );
}
