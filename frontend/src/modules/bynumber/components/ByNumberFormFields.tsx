"use client";

import { UseFormReturn } from "react-hook-form";
import type {
  ByNumberFormInput,
  ByNumberFormData,
  Event,
  Organization,
} from "../types";
import { ByNumberEventTypeStep } from "./ByNumberEventTypeStep";
import { ByNumberEventStep } from "./ByNumberEventStep";
import { ByNumberOrganizationStep } from "./ByNumberOrganizationStep";
import { ByNumberSportsTable } from "./ByNumberSportsTable";
import { ByNumberReviewStep } from "./ByNumberReviewStep";

interface ByNumberFormFieldsProps {
  form: UseFormReturn<ByNumberFormInput, unknown, ByNumberFormData>;
  events: Event[];
  organizations: Organization[];
  step: "event_type" | "event" | "organization" | "sports" | "review";
  eventTypes?: { id: string; name_kh: string }[];
  eventTypeIcons?: Record<string, string>;
  selectedEventType?: string | null;
  onSelectEventType?: (id: string) => void;
  hideOrganization?: boolean;
}

export function ByNumberFormFields({
  form,
  events,
  organizations,
  step,
  eventTypes = [],
  eventTypeIcons = {},
  selectedEventType,
  onSelectEventType,
  hideOrganization = false,
}: ByNumberFormFieldsProps) {
  if (step === "event_type")
    return <ByNumberEventTypeStep eventTypes={eventTypes} eventTypeIcons={eventTypeIcons} selectedEventType={selectedEventType} onSelectEventType={onSelectEventType} />;
  if (step === "event")
    return <ByNumberEventStep form={form} events={events} />;
  if (step === "organization")
    return <ByNumberOrganizationStep form={form} organizations={organizations} />;
  if (step === "sports")
    return <ByNumberSportsTable form={form} />;
  if (step === "review")
    return <ByNumberReviewStep form={form} events={events} organizations={organizations} hideOrganization={hideOrganization} />;

  return null;
}
