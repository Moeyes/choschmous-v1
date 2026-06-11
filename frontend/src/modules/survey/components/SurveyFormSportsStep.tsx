"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Medal, AlertCircle } from "lucide-react";
import type { SurveyFormData, Sport } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared";
import { cn } from "@/shared/utils/cn";

interface SurveyFormSportsStepProps {
  form: UseFormReturn<SurveyFormData>;
  eventSports: Sport[];
}

export function SurveyFormSportsStep({ form, eventSports }: SurveyFormSportsStepProps) {
  const { watch, setValue, trigger, formState } = form;
  const t = useTranslations("survey");

  const selectedSportIds = watch("sportIds") || [];

  const toggleSport = (sportsId: number) => {
    const newIds = selectedSportIds.includes(sportsId)
      ? selectedSportIds.filter((id) => id !== sportsId)
      : [...selectedSportIds, sportsId];
    setValue("sportIds", newIds);
    trigger("sportIds");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Medal} subtitle={t('subtitle')}>
          {t('headings.sports')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("selectSportsHint")}
        </p>

        {eventSports.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t("noSports")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {eventSports.map((sport) => {
                const checked = selectedSportIds.includes(sport.sports_id);
                return (
                  <button
                    key={`${sport.sports_id}-${sport.id}`}
                    type="button"
                    onClick={() => toggleSport(sport.sports_id)}
                    aria-pressed={checked}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-all",
                      "hover:border-primary/40 hover:shadow-sm",
                      checked
                        ? "border-primary bg-primary-50/40 shadow-sm"
                        : "border-border",
                    )}
                  >
                    <div className="relative flex size-10 items-center justify-center rounded-lg bg-primary-50">
                      <Medal className="size-5 text-primary" />
                      {checked && (
                        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium leading-tight text-foreground">
                      {sport.name_kh}
                    </span>
                    {sport.sport_type && (
                      <span className="text-[10px] text-muted-foreground">{sport.sport_type}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                <b>{selectedSportIds.length}</b> {t("selectedCount", { count: selectedSportIds.length })}
              </span>
            </div>
          </>
        )}

        {formState.errors.sportIds && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3 shrink-0" />
            <span>{formState.errors.sportIds.message}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
