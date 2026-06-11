"use client";

import type { Control, FieldErrors } from "react-hook-form";
import { EVENT_PHASES, PhaseStatus } from "../types";
import { SelectField, TextInputField } from "@/shared/form";
import { useTranslations } from "next-intl";

interface EventPhasesFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  errors: FieldErrors;
}

export function EventPhasesFields({ control, errors }: EventPhasesFieldsProps) {
  const t = useTranslations("events");

  const statusOptions = [
    { value: PhaseStatus.AUTO, label: t("phaseStatus.AUTO") },
    { value: PhaseStatus.OPEN, label: t("phaseStatus.OPEN") },
    { value: PhaseStatus.CLOSED, label: t("phaseStatus.CLOSED") },
  ];

  return (
    <div className="space-y-4">
      {EVENT_PHASES.map((phase) => (
        <div
          key={phase}
          className="rounded-lg border border-border bg-muted/30 p-3"
        >
          <p className="mb-2 text-sm font-semibold text-foreground">
            {t(`phases.${phase}`)}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SelectField
              control={control}
              name={`${phase}_status`}
              label={t("phases.status")}
              options={statusOptions}
              error={errors[`${phase}_status`]?.message?.toString()}
            />
            <TextInputField
              control={control}
              name={`${phase}_open_date`}
              label={t("phases.openDate")}
              type="date"
              error={errors[`${phase}_open_date`]?.message?.toString()}
            />
            <TextInputField
              control={control}
              name={`${phase}_close_date`}
              label={t("phases.closeDate")}
              type="date"
              error={errors[`${phase}_close_date`]?.message?.toString()}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
