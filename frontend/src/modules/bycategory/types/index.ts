import type {
  ByCategoryFormData as ByCategorySchemaData,
  ByCategoryFormInput as ByCategorySchemaInput,
} from '../schema/bycategory.schema';

export type { Event, Sport, CategoryRow, CategorySurveyEntry } from '../schema/bycategory.schema';

export type ByCategoryFormData = ByCategorySchemaData;
export type ByCategoryFormInput = ByCategorySchemaInput;

export interface CategorySurveyUpsertPayload {
  event_id: number;
  sport_id: number;
  categories: { name: string; gender: 'MALE' | 'FEMALE' | 'MIXED' }[];
}
