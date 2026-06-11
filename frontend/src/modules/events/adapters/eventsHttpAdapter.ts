import type { IEventRepository } from '../ports/IEventRepository';
import {
    rawEventSchema, rawEventsSchema,
    eventPublicSchema, eventSportPublicSchema,
    eventSportOrgPublicSchema, eventOrganizationPublicSchema,
    eventCategoryPublicSchema,
    type EventPublic, type EventOrganizationPublic,
    type RawEvent, type RawEventSport, type RawSportOrg,
} from '../schema/events.schema';
import {
    apiGetEvents, apiGetEventById, apiGetPublicEventById, apiCreateEvent, apiUpdateEvent, apiDeleteEvent,
    apiUpdateEventPhase,
    apiGetEventSports, apiAddSportToEvent, apiRemoveSportFromEvent,
    apiGetEventSportOrgs, apiAddOrgToEventSport, apiDeleteEventSportOrgLink,
    apiGetEventOrganizations, apiRemoveOrgCompletelyFromEvent,
    apiGetEventSportCategories,
} from '../api';
import type {
    EventCreate, EventUpdate, PhaseUpdatePayload,
    AddSportToEventPayload, AddOrgToEventSportPayload,
    DeleteEventSportOrgLinkPayload, RemoveOrgCompletelyFromEventPayload,
} from '../types';

const PHASE_KEYS = [
    'survey_category_status', 'survey_category_open_date', 'survey_category_close_date',
    'survey_sport_status', 'survey_sport_open_date', 'survey_sport_close_date',
    'survey_number_status', 'survey_number_open_date', 'survey_number_close_date',
    'registration_status', 'registration_open_date', 'registration_close_date',
] as const;

function phasePayload(src: Partial<Record<string, unknown>>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of PHASE_KEYS) {
        const value = src[key];
        if (value !== undefined) out[key] = value === '' ? null : value;
    }
    return out;
}

function mapRawEvent(raw: RawEvent): EventPublic {
    return eventPublicSchema.parse({
        id: raw.id,
        name: raw.name_kh || 'Unnamed Event',
        description: raw.description ?? undefined,
        start_date: raw.start_date || '',
        end_date: raw.end_date || '',
        event_type: raw.type ?? raw.event_type,
        location: raw.location ?? undefined,
        age_mode: raw.age_mode ?? null,
        age_min: raw.age_min ?? null,
        age_max: raw.age_max ?? null,
        survey_category_status: raw.survey_category_status,
        survey_category_open_date: raw.survey_category_open_date ?? null,
        survey_category_close_date: raw.survey_category_close_date ?? null,
        survey_sport_status: raw.survey_sport_status,
        survey_sport_open_date: raw.survey_sport_open_date ?? null,
        survey_sport_close_date: raw.survey_sport_close_date ?? null,
        survey_number_status: raw.survey_number_status,
        survey_number_open_date: raw.survey_number_open_date ?? null,
        survey_number_close_date: raw.survey_number_close_date ?? null,
        registration_status: raw.registration_status,
        registration_open_date: raw.registration_open_date ?? null,
        registration_close_date: raw.registration_close_date ?? null,
        survey_category_is_open: raw.survey_category_is_open,
        survey_sport_is_open: raw.survey_sport_is_open,
        survey_number_is_open: raw.survey_number_is_open,
        registration_is_open: raw.registration_is_open,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
    });
}

export const eventsHttpAdapter: IEventRepository = {
    getAll: async () => {
        const raw = rawEventsSchema.parse(await apiGetEvents());
        return raw.data.map(mapRawEvent);
    },

    getById: async (id: number) => {
        const raw = rawEventSchema.parse(await apiGetEventById(id));
        return mapRawEvent(raw);
    },

    getPublicById: async (id: number) => {
        const raw = rawEventSchema.parse(await apiGetPublicEventById(id));
        return mapRawEvent(raw);
    },

    create: async (dto: EventCreate) => {
        const raw = rawEventSchema.parse(await apiCreateEvent({
            name_kh: dto.name,
            type: dto.event_type,
            description: dto.description || null,
            start_date: dto.start_date,
            end_date: dto.end_date,
            location: dto.location || null,
            age_mode: dto.age_mode,
            age_min: dto.age_min,
            age_max: dto.age_max,
            ...phasePayload(dto as unknown as Record<string, unknown>),
        }));
        return mapRawEvent(raw);
    },

    update: async (dto: EventUpdate) => {
        const { id, name, event_type, description, start_date, end_date, location, age_mode, age_min, age_max } = dto;
        const payload: Record<string, unknown> = { ...phasePayload(dto as unknown as Record<string, unknown>) };
        if (name !== undefined) payload.name_kh = name ?? null;
        if (event_type !== undefined) payload.type = event_type ?? null;
        if (description !== undefined) payload.description = description || null;
        if (start_date !== undefined) payload.start_date = start_date || null;
        if (end_date !== undefined) payload.end_date = end_date || null;
        if (location !== undefined) payload.location = location || null;
        if (age_mode !== undefined) payload.age_mode = age_mode;
        if (age_min !== undefined) payload.age_min = age_min;
        if (age_max !== undefined) payload.age_max = age_max;

        const raw = rawEventSchema.parse(await apiUpdateEvent(id, payload));
        return mapRawEvent(raw);
    },

    delete: async (id: number) => {
        await apiDeleteEvent(id);
    },

    updatePhase: async (payload: PhaseUpdatePayload) => {
        const { id, phase, status, open_date, close_date } = payload;
        const raw = rawEventSchema.parse(await apiUpdateEventPhase(id, {
            phase, status,
            open_date: open_date || null,
            close_date: close_date || null,
        }));
        return mapRawEvent(raw);
    },

    getSports: async (eventId: number) => {
        const raw = await apiGetEventSports(eventId) as { data?: RawEventSport[] };
        const sportList = (Array.isArray(raw) ? raw : (raw.data ?? []))
            .map(s => ({
                id: s.id,
                sports_id: s.sports_id ?? s.id,
                name_kh: s.sport_name ?? 'Unnamed Sport',
                name_en: s.sport_name ?? 'Unnamed Sport',
            }));
        return sportList.map(s => eventSportPublicSchema.parse(s));
    },

    addSportToEvent: async (payload: AddSportToEventPayload) => {
        await apiAddSportToEvent(payload);
    },

    removeSportFromEvent: async (associationId: number) => {
        await apiRemoveSportFromEvent(associationId);
    },

    getSportOrgs: async (eventId: number, sportId: number) => {
        const raw = await apiGetEventSportOrgs(eventId, sportId) as { data?: RawSportOrg[] };
        const orgs = (Array.isArray(raw) ? raw : (raw.data ?? [])).map(o => ({
            id: o.organization_id,
            name_kh: o.organization_name,
            name_en: o.organization_name,
            _linkId: o.id,
        }));
        return orgs.map(o => eventSportOrgPublicSchema.parse(o));
    },

    addOrgToEventSport: async (payload: AddOrgToEventSportPayload) => {
        await apiAddOrgToEventSport(payload);
    },

    deleteEventSportOrgLink: async (payload: DeleteEventSportOrgLinkPayload) => {
        await apiDeleteEventSportOrgLink(payload.association_id);
    },

    getOrganizations: async (eventId: number) => {
        const raw = await apiGetEventOrganizations(eventId);
        const list = (Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? [])) as EventOrganizationPublic[];
        return list.map(o => eventOrganizationPublicSchema.parse(o));
    },

    removeOrgCompletelyFromEvent: async (payload: RemoveOrgCompletelyFromEventPayload) => {
        await apiRemoveOrgCompletelyFromEvent(payload);
    },

    getSportCategories: async (eventId: number, sportId: number) => {
        const raw = await apiGetEventSportCategories(eventId, sportId);
        const list = (Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? []));
        return list.map(c => eventCategoryPublicSchema.parse(c));
    },
};
