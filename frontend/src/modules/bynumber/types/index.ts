import type {
    ByNumberFormData as ByNumberSchemaData,
    ByNumberFormInput as ByNumberSchemaInput,
    SportRow as SportRowSchema,
} from '../schema/bynumber.schema';

export type { Event, Organization, Sport } from '../schema/bynumber.schema';

export type SportRow = SportRowSchema;
export type ByNumberFormData = ByNumberSchemaData;
export type ByNumberFormInput = ByNumberSchemaInput;

export interface ParticipationPerSport {
    org_id: number;
    sports_Events_id: number;
    events_id: number;
    sports_id: number;
    organization_id: number;
    athlete_male_count: number;
    athlete_female_count: number;
    leader_male_count: number;
    leader_female_count: number;
}


