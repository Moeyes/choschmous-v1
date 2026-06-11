"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Building2, Medal, ClipboardCheck } from "lucide-react";
import type { Event, Organization, Sport } from "../types";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/shared";
import { cn } from "@/shared/utils/cn";

interface SurveyFormReviewStepProps {
  events: Event[];
  organizations: Organization[];
  eventSports: Sport[];
  selectedEventId?: number;
  selectedOrgId?: number;
  selectedSportIds: number[];
  hideOrganization?: boolean;
}

export function SurveyFormReviewStep({
  events,
  organizations,
  eventSports,
  selectedEventId,
  selectedOrgId,
  selectedSportIds,
  hideOrganization = false,
}: SurveyFormReviewStepProps) {
  const t = useTranslations("survey");

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);
  const selectedSports = eventSports.filter((s) =>
    selectedSportIds.includes(s.sports_id),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={ClipboardCheck} subtitle={t('subtitle')}>
          {t('headings.review')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
              <CalendarDays className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{t("review.event")}</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-foreground">{selectedEvent?.name_kh}</p>
            </div>
          </Card>

          {!hideOrganization && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
                <Building2 className="size-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t("review.organization")}</span>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-foreground">{selectedOrg?.name_kh}</p>
              </div>
            </Card>
          )}

          <Card
            className={cn(
              "overflow-hidden",
              hideOrganization && "md:col-span-2",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border bg-secondary/5 px-5 py-3">
              <Medal className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("review.sports")} ({selectedSports.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-4">
              {selectedSports.map((sport) => (
                <Badge key={sport.sports_id} variant="primary" size="sm">
                  <Medal className="size-3" />
                  {sport.name_kh}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
