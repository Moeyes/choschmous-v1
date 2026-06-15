import { z } from 'zod';
import type { IByCategoryRepository } from '../ports/IByCategoryRepository';
import type { Event, CategoryRow, CategorySurveyEntry } from '../schema/bycategory.schema';
import {
  eventListResponseSchema,
  categorySurveyEntrySchema,
} from '../schema/bycategory.schema';
import type { CategorySurveyUpsertPayload } from '../types';
import {
  apiFetchEligibleEvents,
  apiFetchCategories,
  apiSubmitCategories,
  apiFetchSport,
} from '../api';

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export const byCategoryHttpAdapter: IByCategoryRepository = {
  async fetchEligibleEvents(): Promise<Event[]> {
    const cached = getCached<Event[]>('bycategory-events');
    if (cached) return cached;
    try {
      const raw = await apiFetchEligibleEvents();
      const parsed = eventListResponseSchema.parse(raw);
      const eligible = parsed.data.filter((e) => e.survey_category_is_open !== false);
      setCached('bycategory-events', eligible);
      return eligible;
    } catch {
      return [];
    }
  },

  async fetchCategories(eventId: number, sportId: number): Promise<CategorySurveyEntry[]> {
    const cacheKey = `bycategory-cats-${eventId}-${sportId}`;
    const cached = getCached<CategorySurveyEntry[]>(cacheKey);
    if (cached) return cached;
    try {
      const raw = await apiFetchCategories(eventId, sportId);
      const parsed = z.array(categorySurveyEntrySchema).parse(raw);
      setCached(cacheKey, parsed);
      return parsed;
    } catch {
      return [];
    }
  },

  async fetchPreviousCategories(sportId: number, excludeEventId: number): Promise<CategoryRow[]> {
    try {
      const raw = await apiFetchEligibleEvents();
      const parsed = eventListResponseSchema.parse(raw);
      const prevEvents = parsed.data.filter(
        (e: Event) => e.id !== excludeEventId,
      );
      for (const ev of prevEvents) {
        try {
          const cats = await apiFetchCategories(ev.id, sportId);
          const parsedCats = z.array(categorySurveyEntrySchema).parse(cats);
          if (parsedCats.length > 0) {
            return parsedCats.map((c) => ({
              name: c.category,
              gender: (c.gender ?? 'MIXED') as 'MALE' | 'FEMALE' | 'MIXED',
            }));
          }
        } catch {
          continue;
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  async fetchSportName(sportId: number): Promise<string> {
    // Unlike the list reads above, this does not swallow errors: the caller
    // (ByCategoryForm) catches a rejection to render its own `Sport #<id>`
    // fallback, so behaviour stays identical to the previous inline lookup.
    const raw = await apiFetchSport(sportId);
    return (raw as { name_kh: string }).name_kh;
  },

  async submitCategories(payload: CategorySurveyUpsertPayload): Promise<CategorySurveyEntry[]> {
    const raw = await apiSubmitCategories({
      event_id: payload.event_id,
      sport_id: payload.sport_id,
      categories: payload.categories,
    });
    const parsed = z.array(categorySurveyEntrySchema).parse(raw);
    cache.delete(`bycategory-cats-${payload.event_id}-${payload.sport_id}`);
    return parsed;
  },
};
