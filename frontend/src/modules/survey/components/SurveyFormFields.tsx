"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { LayoutGrid, CalendarDays, Building2, Medal } from "lucide-react";
import type { SurveyFormData, Event, Organization, Sport } from "../types";
import { SurveyFormSportsStep } from "./SurveyFormSportsStep";
import { SurveyFormReviewStep } from "./SurveyFormReviewStep";
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from "@/shared";
import type { RadioCardOption } from "@/shared";

interface SurveyFormFieldsProps {
  form: UseFormReturn<SurveyFormData>;
  events: Event[];
  organizations: Organization[];
  eventSports: Sport[];
  step: "event_type" | "event" | "organization" | "sports" | "review";
  eventTypes?: { id: string; name_kh: string }[];
  eventTypeIcons?: Record<string, string>;
  selectedEventType?: string | null;
  onSelectEventType?: (id: string) => void;
  hideOrganization?: boolean;
}

function emptyState(message: string) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function SurveyFormFields({
  form,
  events,
  organizations,
  eventSports,
  step,
  eventTypes = [],
  eventTypeIcons = {},
  selectedEventType,
  onSelectEventType,
  hideOrganization = false,
}: SurveyFormFieldsProps) {
  const { watch, setValue, trigger } = form;
  const t = useTranslations("survey");

  const selectedEventId = watch("eventId");
  const selectedOrgId = watch("organizationId");
  const selectedSportIds = watch("sportIds") || [];

  const iconMap: Record<string, typeof CalendarDays> = {
    Trophy: Medal,
    CalendarDays,
    Building2,
    LayoutGrid,
  };

  if (step === "event_type") {
    const options: RadioCardOption[] = eventTypes.map((type) => ({
      value: type.id,
      label: type.name_kh,
      icon: iconMap[eventTypeIcons[type.id] || 'Trophy'] || Medal,
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle icon={LayoutGrid} subtitle={t('subtitle')}>
            {t('headings.event_type')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioCardGroup
            options={options}
            value={selectedEventType}
            onChange={(id) => onSelectEventType?.(id)}
          />
        </CardContent>
      </Card>
    );
  }

  if (step === "event") {
    const options: RadioCardOption[] = events.map((event) => ({
      value: String(event.id),
      label: event.name_kh,
      icon: CalendarDays,
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle icon={CalendarDays} subtitle={t('subtitle')}>
            {t('headings.event')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? emptyState(t("noEvents")) : (
            <RadioCardGroup
              options={options}
              value={selectedEventId != null ? String(selectedEventId) : null}
              onChange={(id) => {
                setValue("eventId", Number(id));
                trigger("eventId");
              }}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === "organization") {
    const options: RadioCardOption[] = organizations.map((org) => ({
      value: String(org.id),
      label: org.name_kh,
      description: org.type || undefined,
      icon: Building2,
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle icon={Building2} subtitle={t('subtitle')}>
            {t('headings.organization')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? emptyState(t("noOrgs")) : (
            <div className="max-h-[400px] overflow-y-auto">
              <RadioCardGroup
                options={options}
                value={selectedOrgId != null ? String(selectedOrgId) : null}
                onChange={(id) => {
                  setValue("organizationId", Number(id));
                  trigger("organizationId");
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === "sports") {
    return <SurveyFormSportsStep form={form} eventSports={eventSports} />;
  }

  if (step === "review") {
    return (
      <SurveyFormReviewStep
        events={events}
        organizations={organizations}
        eventSports={eventSports}
        selectedEventId={selectedEventId}
        selectedOrgId={selectedOrgId}
        selectedSportIds={selectedSportIds}
        hideOrganization={hideOrganization}
      />
    );
  }

  return null;
}
