import * as z from "zod";
import { EventType, AgeMode, PhaseStatus, EVENT_PHASES } from "../types";

export const eventSchema = z
  .object({
    name: z.string().min(3),
    description: z.string().optional().or(z.literal("")),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    event_type: z.nativeEnum(EventType),
    location: z.string().min(2),
    age_mode: z.nativeEnum(AgeMode),
    age_min: z.string().min(1),
    age_max: z.string().min(1),

    survey_category_status: z.nativeEnum(PhaseStatus),
    survey_category_open_date: z.string().optional().or(z.literal("")),
    survey_category_close_date: z.string().optional().or(z.literal("")),
    survey_sport_status: z.nativeEnum(PhaseStatus),
    survey_sport_open_date: z.string().optional().or(z.literal("")),
    survey_sport_close_date: z.string().optional().or(z.literal("")),
    survey_number_status: z.nativeEnum(PhaseStatus),
    survey_number_open_date: z.string().optional().or(z.literal("")),
    survey_number_close_date: z.string().optional().or(z.literal("")),
    registration_status: z.nativeEnum(PhaseStatus),
    registration_open_date: z.string().optional().or(z.literal("")),
    registration_close_date: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after start date",
        path: ["end_date"],
      });

    const min = Number(data.age_min);
    const max = Number(data.age_max);
    if (
      data.age_min &&
      data.age_max &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min > max
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum must be less than or equal to maximum",
        path: ["age_max"],
      });

    for (const phase of EVENT_PHASES) {
      const open = data[`${phase}_open_date`];
      const close = data[`${phase}_close_date`];
      if (open && close && close < open)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Close date must be on or after open date",
          path: [`${phase}_close_date`],
        });
    }
  });

export type EventFormValues = z.infer<typeof eventSchema>;
