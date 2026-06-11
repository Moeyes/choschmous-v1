import type {
    Event, Organization, Sport, SportRow,
    ByNumberSubmissionPayload,
} from '../schema/bynumber.schema';

export interface IByNumberRepository {
    fetchEvents(): Promise<Event[]>;
    fetchAllSports(): Promise<{ id: number; name_kh: string }[]>;
    fetchAllOrganizations(): Promise<Organization[]>;
    fetchEventSports(eventId: number): Promise<Sport[]>;
    fetchByNumberData(): Promise<{ events: Event[]; organizations: Organization[] }>;
    fetchOrgEventSports(organizationId: number, eventId: number): Promise<SportRow[]>;
    submitByNumber(payload: ByNumberSubmissionPayload): Promise<void>;
    clearCache(): void;
}
