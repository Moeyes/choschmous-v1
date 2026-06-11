/**
 * Event Feature - Types
 */

export enum EventType {
  NATIONAL = 'កីឡាជាតិ',
  UNIVERSITY = 'កីឡាឧត្តមសិក្សា និងមធ្យមសិក្សា​បចេ្ចកទេសថ្នាក់ជាតិថ្នាក់ជាតិ',
  HIGH_SCHOOL = 'សិស្សមធ្យមសិក្សា​ថ្នាក់ជាតិ',
  PRIMARY_SCHOOL = 'កីឡាសិស្សបឋមសិក្សាជាតិ',
}

/** How age_min/age_max are interpreted (must match backend AgeMode). */
export enum AgeMode {
  BIRTH_YEAR = 'BIRTH_YEAR',
  EXACT_AGE = 'EXACT_AGE',
}

/** Lifecycle gate for a single phase (must match backend PhaseStatus). */
export enum PhaseStatus {
  AUTO = 'AUTO',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export const EVENT_PHASES = ['survey_category', 'survey_sport', 'survey_number', 'registration'] as const;

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  event_type: EventType;
  location?: string;
  age_mode?: AgeMode | null;
  age_min?: number | null;
  age_max?: number | null;
  survey_category_status?: PhaseStatus;
  survey_category_open_date?: string | null;
  survey_category_close_date?: string | null;
  survey_sport_status?: PhaseStatus;
  survey_sport_open_date?: string | null;
  survey_sport_close_date?: string | null;
  survey_number_status?: PhaseStatus;
  survey_number_open_date?: string | null;
  survey_number_close_date?: string | null;
  registration_status?: PhaseStatus;
  registration_open_date?: string | null;
  registration_close_date?: string | null;
  created_at?: string;
  updated_at?: string;
  survey_category_is_open?: boolean;
  survey_sport_is_open?: boolean;
  survey_number_is_open?: boolean;
  registration_is_open?: boolean;
}

export interface EventCreate {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  event_type: EventType;
  location: string;
  age_mode: AgeMode;
  age_min: number;
  age_max: number;
}

export interface EventUpdate extends Partial<EventCreate> {
  id: number;
}

/** Body for the dedicated PATCH /events/{id}/phase quick action. */
export interface PhaseUpdatePayload {
  id: number;
  phase: string;
  status: PhaseStatus;
  open_date?: string | null;
  close_date?: string | null;
}

export interface Organization {
  id: number;
  name_kh: string;
  name_en: string;
  code?: string;
  type?: string;
}

export interface Sport {
  id: number; // sports_event.id (association ID — used for removal)
  sports_id: number; // Sport.id (actual sport ID — used for filtering)
  name_kh: string;
  name_en: string;
}

export interface Category {
  id: number;
  category: string;
  sport_name?: string;
  gender?: string;
}

export interface AddSportToEventPayload {
  event_id: number;
  sport_id: number;
}

export interface AddOrgToEventSportPayload {
  event_id: number;
  sport_id: number;
  org_id: number;
}

export interface DeleteEventSportOrgLinkPayload {
  association_id: number;
  // for cache invalidation only
  event_id: number;
  sport_id: number;
}

export interface RemoveOrgCompletelyFromEventPayload {
  event_id: number;
  org_id: number;
}
