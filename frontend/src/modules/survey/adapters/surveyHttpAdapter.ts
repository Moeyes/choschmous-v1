import { z } from 'zod';
import axios from 'axios';
import type { ISurveyRepository } from '../ports/ISurveyRepository';
import type { Event, Organization, Sport, SurveySubmissionPayload } from '../schema/survey.schema';
import {
    eventListResponseSchema, sportListResponseSchema, organizationListResponseSchema,
    sportsEventResponseSchema, sportSchema,
} from '../schema/survey.schema';
import {
    apiGetEvents, apiGetAllSports, apiGetAllOrganizations,
    apiGetEventSports, apiAddOrgToSport,
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

export const surveyHttpAdapter: ISurveyRepository = {
    async fetchEvents() {
        const cached = getCached<Event[]>('events');
        if (cached) return cached;
        try {
            const raw = await apiGetEvents();
            const parsed = eventListResponseSchema.parse(raw);
            setCached('events', parsed.data);
            return parsed.data;
        } catch {
            return [];
        }
    },

    async fetchAllSports() {
        const cached = getCached<{ id: number; name_kh: string }[]>('all-sports');
        if (cached) return cached;
        try {
            const raw = await apiGetAllSports();
            const parsed = sportListResponseSchema.parse(raw);
            setCached('all-sports', parsed.data);
            return parsed.data;
        } catch {
            return [];
        }
    },

    async fetchAllOrganizations() {
        const cached = getCached<Organization[]>('organizations');
        if (cached) return cached;
        try {
            const raw = await apiGetAllOrganizations();
            const parsed = organizationListResponseSchema.parse(raw);
            setCached('organizations', parsed.data);
            return parsed.data;
        } catch {
            return [];
        }
    },

    async fetchEventSports(eventId: number) {
        const cacheKey = `event-sports-${eventId}`;
        const cached = getCached<Sport[]>(cacheKey);
        if (cached) return cached;
        try {
            const raw = await apiGetEventSports(eventId);
            const sportsEvents = z.array(sportsEventResponseSchema).parse(raw);
            const allSports = await this.fetchAllSports();
            const sports: Sport[] = sportsEvents.map((se) => {
                const matchedSport = allSports.find(s => s.name_kh === se.sport_name);
                return sportSchema.parse({
                    id: se.id,
                    sports_id: matchedSport ? matchedSport.id : 0,
                    name_kh: se.sport_name || '',
                    created_at: se.created_at,
                });
            }).filter(s => s.sports_id !== 0);
            setCached(cacheKey, sports);
            return sports;
        } catch {
            return [];
        }
    },

    async fetchSurveyData() {
        try {
            const [events, organizations] = await Promise.all([
                this.fetchEvents(),
                this.fetchAllOrganizations(),
            ]);
            return { events, organizations };
        } catch {
            return { events: [], organizations: [] };
        }
    },

    async submitSurvey(payload: SurveySubmissionPayload) {
        const { organization_id, event_id, sport_ids } = payload;
        const linkPromises = sport_ids.map(async (sport_id) => {
            const body = { org_id: organization_id, events_id: event_id, sports_id: sport_id };
            try {
                await apiAddOrgToSport(body);
            } catch (error) {
                // The org may already be registered for this sport+event. The backend
                // rejects that with 400; for an idempotent survey submit we treat it as
                // a no-op (skip) rather than failing the whole submission. Message-agnostic
                // so it can't regress if the backend wording changes.
                if (axios.isAxiosError(error) && error.response?.status === 400) {
                    return;
                }
                throw error;
            }
        });
        await Promise.all(linkPromises);

        // A registration just changed the server state. Both this module and the
        // bynumber module cache org/event/sport reads for 5 minutes, so without
        // invalidation the "By Sport" records view keeps showing the stale (often
        // empty) result and the new registration looks like it wasn't saved.
        this.clearCache();
        try {
            const { bynumberRepository } = await import('@/modules/bynumber/adapters');
            bynumberRepository.clearCache();
        } catch {
            // bynumber module unavailable; survey cache is still cleared above.
        }
    },

    clearCache() {
        cache.clear();
    },
};
