"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Event,
  EventType,
  EventCreate,
  AgeMode,
  PhaseStatus,
} from "../types";
import { useCreateEvent, useUpdateEvent } from "../hooks";
import { Button } from "@/shared/ui/button";
import { TextInputField, SelectField } from "@/shared/form";
import { FormSection } from "@/shared";
import { Calendar, CalendarClock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { eventSchema, EventFormValues } from "./eventForm.schema";
import { EventPhasesFields } from "./EventPhasesFields";

interface EventFormProps {
  event?: Event;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EventForm({ event, onSuccess, onCancel }: EventFormProps) {
  const isEditing = !!event;
  const { mutate: create, isPending: isCreating } = useCreateEvent();
  const { mutate: update, isPending: isUpdating } = useUpdateEvent();
  const t = useTranslations("events");
  const tCommon = useTranslations("common");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: event
      ? {
          name: event.name,
          description: event.description || "",
          start_date: event.start_date,
          end_date: event.end_date,
          event_type: event.event_type,
          location: event.location || "",
          age_mode: event.age_mode ?? AgeMode.BIRTH_YEAR,
          age_min: event.age_min != null ? String(event.age_min) : "",
          age_max: event.age_max != null ? String(event.age_max) : "",
          survey_category_status: event.survey_category_status ?? PhaseStatus.AUTO,
          survey_category_open_date: event.survey_category_open_date || "",
          survey_category_close_date: event.survey_category_close_date || "",
          survey_sport_status: event.survey_sport_status ?? PhaseStatus.AUTO,
          survey_sport_open_date: event.survey_sport_open_date || "",
          survey_sport_close_date: event.survey_sport_close_date || "",
          survey_number_status: event.survey_number_status ?? PhaseStatus.AUTO,
          survey_number_open_date: event.survey_number_open_date || "",
          survey_number_close_date: event.survey_number_close_date || "",
          registration_status: event.registration_status ?? PhaseStatus.AUTO,
          registration_open_date: event.registration_open_date || "",
          registration_close_date: event.registration_close_date || "",
        }
      : {
          name: "",
          description: "",
          start_date: "",
          end_date: "",
          event_type: EventType.NATIONAL,
          location: "",
          age_mode: AgeMode.BIRTH_YEAR,
          age_min: "",
          age_max: "",
          survey_category_status: PhaseStatus.AUTO,
          survey_category_open_date: "",
          survey_category_close_date: "",
          survey_sport_status: PhaseStatus.AUTO,
          survey_sport_open_date: "",
          survey_sport_close_date: "",
          survey_number_status: PhaseStatus.AUTO,
          survey_number_open_date: "",
          survey_number_close_date: "",
          registration_status: PhaseStatus.AUTO,
          registration_open_date: "",
          registration_close_date: "",
        },
  });

  // Age labels switch between "birth year" and "age" depending on the mode.
  const ageMode = useWatch({ control, name: "age_mode" });
  const isBirthYear = ageMode === AgeMode.BIRTH_YEAR;
  const ageMinLabel = isBirthYear ? t("birthYearFrom") : t("ageMin");
  const ageMaxLabel = isBirthYear ? t("birthYearTo") : t("ageMax");

  const onSubmit = (data: EventFormValues) => {
    const payload = {
      ...data,
      age_min: Number(data.age_min),
      age_max: Number(data.age_max),
    };
    if (isEditing) update({ id: event.id, ...payload }, { onSuccess });
    else create(payload as EventCreate, { onSuccess });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormSection
        title={t("eventName")}
        description={t("description_field")}
        icon={Calendar}
      >
        <div className="space-y-3">
          <TextInputField
            control={control}
            name="name"
            label={t("eventName")}
            required
            error={errors.name?.message}
          />
          <TextInputField
            control={control}
            name="description"
            label={t("description_field")}
            error={errors.description?.message}
          />
        </div>
      </FormSection>

      <FormSection title={t("schedule")} description="" icon={Calendar}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInputField
            control={control}
            name="start_date"
            label={t("startDate")}
            type="date"
            required
            error={errors.start_date?.message}
          />
          <TextInputField
            control={control}
            name="end_date"
            label={t("endDate")}
            type="date"
            required
            error={errors.end_date?.message}
          />
        </div>
      </FormSection>

      <FormSection title={t("eventType")} description="" icon={Calendar}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            control={control}
            name="event_type"
            label={t("eventType")}
            required
            options={[
              { value: EventType.NATIONAL, label: t("types.NATIONAL") },
              { value: EventType.UNIVERSITY, label: t("types.UNIVERSITY") },
              { value: EventType.HIGH_SCHOOL, label: t("types.HIGH_SCHOOL") },
              {
                value: EventType.PRIMARY_SCHOOL,
                label: t("types.PRIMARY_SCHOOL"),
              },
            ]}
            error={errors.event_type?.message}
          />
          <TextInputField
            control={control}
            name="location"
            label={t("location")}
            required
            error={errors.location?.message}
          />
        </div>
      </FormSection>

      <FormSection
        title={t("ageRule")}
        description={t("ageRuleHint")}
        icon={Users}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            control={control}
            name="age_mode"
            label={t("ageMode")}
            required
            options={[
              { value: AgeMode.BIRTH_YEAR, label: t("ageModes.BIRTH_YEAR") },
              { value: AgeMode.EXACT_AGE, label: t("ageModes.EXACT_AGE") },
            ]}
            error={errors.age_mode?.message}
          />
          <TextInputField
            control={control}
            name="age_min"
            label={ageMinLabel}
            type="number"
            required
            error={errors.age_min?.message}
          />
          <TextInputField
            control={control}
            name="age_max"
            label={ageMaxLabel}
            type="number"
            required
            error={errors.age_max?.message}
          />
        </div>
      </FormSection>

      <FormSection
        title={t("phases.title")}
        description={t("phases.hint")}
        icon={CalendarClock}
      >
        <EventPhasesFields control={control} errors={errors} />
      </FormSection>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" loading={isCreating || isUpdating}>
          {isCreating || isUpdating
            ? tCommon("saving")
            : isEditing
              ? t("editEvent")
              : t("createEvent")}
        </Button>
      </div>
    </form>
  );
}
