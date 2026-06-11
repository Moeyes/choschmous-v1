import type { EventPublic } from '../schema/events.schema';
import type { EventSportPublic, EventSportOrgPublic } from '../schema/events.schema';
import type { EventOrganizationPublic, EventCategoryPublic } from '../schema/events.schema';
import type { EventCreate, EventUpdate } from '../types';
import type {
    AddSportToEventPayload, AddOrgToEventSportPayload,
    DeleteEventSportOrgLinkPayload, RemoveOrgCompletelyFromEventPayload,
    PhaseUpdatePayload,
} from '../types';

export interface IEventRepository {
    getAll(): Promise<EventPublic[]>;
    getById(id: number): Promise<EventPublic>;
    /** Public, unauthenticated fetch — SSR-safe (see api/apiGetPublicEventById). */
    getPublicById(id: number): Promise<EventPublic>;
    create(dto: EventCreate): Promise<EventPublic>;
    update(dto: EventUpdate): Promise<EventPublic>;
    delete(id: number): Promise<void>;
    updatePhase(payload: PhaseUpdatePayload): Promise<EventPublic>;

    getSports(eventId: number): Promise<EventSportPublic[]>;
    addSportToEvent(payload: AddSportToEventPayload): Promise<void>;
    removeSportFromEvent(associationId: number): Promise<void>;

    getSportOrgs(eventId: number, sportId: number): Promise<EventSportOrgPublic[]>;
    addOrgToEventSport(payload: AddOrgToEventSportPayload): Promise<void>;
    deleteEventSportOrgLink(payload: DeleteEventSportOrgLinkPayload): Promise<void>;

    getOrganizations(eventId: number): Promise<EventOrganizationPublic[]>;
    removeOrgCompletelyFromEvent(payload: RemoveOrgCompletelyFromEventPayload): Promise<void>;

    getSportCategories(eventId: number, sportId: number): Promise<EventCategoryPublic[]>;
}
