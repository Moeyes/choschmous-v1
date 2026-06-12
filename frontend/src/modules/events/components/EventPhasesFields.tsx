"use client";

import { useController, useFormContext } from "react-hook-form";
import { EVENT_PHASES, PhaseStatus } from "../types";
import { SelectField, TextInputField } from "@/shared/form";
import { useTranslations } from "next-intl";

/**
 * Renders phase-gate fields for all four event lifecycle phases.
 * Reads form control from useFormContext instead of prop-drilling Control<T>.
 */
export function EventPhasesFields() {
  const t = useTranslations("events");
  const { control, formState: { errors } } = useFormContext();

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
              error={(errors as Record<string, { message?: string } | undefined>)[`${phase}_status`]?.message}
            />
            <TextInputField
              control={control}
              name={`${phase}_open_date`}
              label={t("phases.openDate")}
              type="date"
              error={(errors as Record<string, { message?: string } | undefined>)[`${phase}_open_date`]?.message}
            />
            <TextInputField
              control={control}
              name={`${phase}_close_date`}
              label={t("phases.closeDate")}
              type="date"
              error={(errors as Record<string, { message?: string } | undefined>)[`${phase}_close_date`]?.message}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
