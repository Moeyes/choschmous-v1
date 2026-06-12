import { z } from 'zod';

const eventSchema = z.object({
  id: z.number(),
  name_kh: z.string(),
  type: z.string().optional(),
  survey_category_is_open: z.boolean().optional(),
  created_at: z.string().optional(),
});

const sportSchema = z.object({
  id: z.number(),
  name_kh: z.string(),
});

const categoryRowSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  gender: z.enum(['MALE', 'FEMALE', 'MIXED']),
});

export const categorySurveyEntrySchema = z.object({
  id: z.number(),
  sports_id: z.number().nullable().optional(),
  category: z.string(),
  gender: z.enum(['MALE', 'FEMALE', 'MIXED']).nullable().optional(),
  events_id: z.number().nullable().optional(),
  created_at: z.string().optional(),
});

export const eventListResponseSchema = z.object({
  data: z.array(eventSchema),
});

export const byCategorySchema = z.object({
  eventId: z.number().int().positive('Event is required'),
  sportId: z.number().int().positive(),
  sportName: z.string().optional(),
  categories: z
    .array(categoryRowSchema)
    .min(1, 'Add at least one category'),
  previousCategories: z.array(categoryRowSchema).optional(),
});

export type Event = z.infer<typeof eventSchema>;
export type Sport = z.infer<typeof sportSchema>;
export type CategoryRow = z.infer<typeof categoryRowSchema>;
export type CategorySurveyEntry = z.infer<typeof categorySurveyEntrySchema>;
export type ByCategoryFormInput = z.input<typeof byCategorySchema>;
export type ByCategoryFormData = z.output<typeof byCategorySchema>;
