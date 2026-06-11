import type { Event, Organization, Sport, SurveySubmissionPayload } from '../schema/survey.schema';

export interface ISurveyRepository {
    fetchEvents(): Promise<Event[]>;
    fetchAllSports(): Promise<{ id: number; name_kh: string }[]>;
    fetchAllOrganizations(): Promise<Organization[]>;
    fetchEventSports(eventId: number): Promise<Sport[]>;
    fetchSurveyData(): Promise<{ events: Event[]; organizations: Organization[] }>;
    submitSurvey(payload: SurveySubmissionPayload): Promise<void>;
    clearCache(): void;
}
