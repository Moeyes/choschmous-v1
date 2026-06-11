import { z } from 'zod';
import { AxiosError } from 'axios';
import type { IByNumberRepository } from '../ports/IByNumberRepository';
import type {
    Event, Organization, Sport, SportRow, ByNumberSubmissionPayload,
} from '../schema/bynumber.schema';
import {
    eventListResponseSchema, sportListResponseSchema, organizationListResponseSchema,
    sportsEventResponseSchema, sportEventOrgResponseSchema, sportSchema,
} from '../schema/bynumber.schema';
import {
    apiGetEvents, apiGetAllSports, apiGetAllOrganizations,
    apiGetEventSports, apiGetSportOrgs, apiGetAllSportsList,
    apiCreateParticipationPerSport,
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

export const byNumberHttpAdapter: IByNumberRepository = {
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
            const sports: Sport[] = sportsEvents.map((se) => sportSchema.parse({
                id: se.id,
                name_kh: se.sport_name || '',
                created_at: se.created_at,
            }));
            setCached(cacheKey, sports);
            return sports;
        } catch {
            return [];
        }
    },

    async fetchByNumberData() {
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

    async fetchOrgEventSports(organizationId: number, eventId: number) {
        const cacheKey = `org-event-sports-${organizationId}-${eventId}`;
        const cached = getCached<SportRow[]>(cacheKey);
        if (cached) return cached;
        try {
            const raw = await apiGetEventSports(eventId);
            const eventSports = z.array(sportsEventResponseSchema).parse(raw);
            const allSportsRaw = await apiGetAllSportsList();
            const allSportsParsed = z.object({ data: z.array(z.object({ id: z.number(), name_kh: z.string() })) }).parse(allSportsRaw);
            const allSports = allSportsParsed.data;

            const sportsResults: SportRow[] = [];
            const orgCheckPromises = eventSports.map(async (es) => {
                const matchedSport = allSports.find(s => s.name_kh === es.sport_name);
                if (!matchedSport) return;
                try {
                    const orgsRaw = await apiGetSportOrgs(eventId, matchedSport.id);
                    const orgs = z.array(sportEventOrgResponseSchema).parse(orgsRaw);
                    const ourOrgLink = orgs.find(o => o.organization_id === organizationId);
                    if (ourOrgLink) {
                        sportsResults.push({
                            sport_id: matchedSport.id,
                            sport_name_kh: es.sport_name || '',
                            athlete_male_count: 0,
                            athlete_female_count: 0,
                            leader_male_count: 0,
                            leader_female_count: 0,
                            sportsEventOrgId: ourOrgLink.id,
                        });
                    }
                } catch {
                    // Org lookup for this sport failed; skip it and continue with the rest.
                }
            });
            await Promise.all(orgCheckPromises);
            setCached(cacheKey, sportsResults);
            return sportsResults;
        } catch {
            return [];
        }
    },

    async submitByNumber(payload: ByNumberSubmissionPayload) {
        const { organization_id, event_id, sports } = payload;
        const submitPromises = sports.map(async (sport) => {
            try {
                await apiCreateParticipationPerSport({
                    org_id: organization_id,
                    events_id: event_id,
                    sports_id: sport.sport_id,
                    organization_id,
                    athlete_male_count: sport.athlete_male_count,
                    athlete_female_count: sport.athlete_female_count,
                    leader_male_count: sport.leader_male_count,
                    leader_female_count: sport.leader_female_count,
                });
            } catch (error) {
                if (error instanceof AxiosError && error.response?.status === 400) {
                    return;
                }
                throw error;
            }
        });
        await Promise.all(submitPromises);
        cache.delete(`org-event-sports-${organization_id}-${event_id}`);
    },

    clearCache() {
        cache.clear();
    },
};
