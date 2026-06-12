import type { Event, Organization, Sport, SurveySubmissionPayload } from '../schema/survey.schema';

export interface ISurveyRepository {
    fetchEvents(): Promise<Event[]>;
    fetchAllSports(): Promise<{ id: number; name_kh: string }[]>;
    fetchAllOrganizations(): Promise<Organization[]>;
    fetchEventSports(eventId: number): Promise<Sport[]>;
    fetchSurveyData(): Promise<{ events: Event[]; organizations: Organization[] }>;
    fetchExistingOrgSports(eventId: number, orgId: number): Promise<Array<{ sport_id: number; created_at: string }>>;
    submitSurvey(payload: SurveySubmissionPayload): Promise<void>;
    clearCache(): void;
}
