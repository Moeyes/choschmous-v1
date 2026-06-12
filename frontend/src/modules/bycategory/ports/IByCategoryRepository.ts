import type { Event, CategoryRow, CategorySurveyEntry } from '../schema/bycategory.schema';
import type { CategorySurveyUpsertPayload } from '../types';

export interface IByCategoryRepository {
  fetchEligibleEvents(): Promise<Event[]>;
  fetchCategories(eventId: number, sportId: number): Promise<CategorySurveyEntry[]>;
  fetchPreviousCategories(sportId: number, excludeEventId: number): Promise<CategoryRow[]>;
  submitCategories(payload: CategorySurveyUpsertPayload): Promise<CategorySurveyEntry[]>;
}
