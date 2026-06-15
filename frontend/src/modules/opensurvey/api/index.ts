import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type {
  OpenSurveyFieldCreateDTO,
  OpenSurveyFieldUpdateDTO,
} from '../schema/openSurveyField.schema';

// Raw HTTP calls. ONLY the adapter imports these; everything else goes through
// the port. No Zod parsing here — that happens in the adapter.

export async function apiGetEvents() {
  // Only events whose open-survey phase is live. Mirrors how the other survey
  // modules request only-open events (server filters via ?survey_open_open=true).
  const response = await apiClient.get(API.openSurvey.events, {
    params: { survey_open_open: true },
  });
  return response.data;
}

export async function apiGetFillView(eventId: number, organizationId?: number) {
  const response = await apiClient.get(API.openSurvey.responses(eventId, organizationId));
  return response.data;
}

export async function apiSubmitResponses(
  eventId: number,
  responses: Record<number, string | null>,
  organizationId?: number,
) {
  const response = await apiClient.post(API.openSurvey.responses(eventId, organizationId), {
    responses,
  });
  return response.data;
}

/* ---- Admin field management (producer side) ----------------------------- */

export async function apiListFields(eventId: number, includeInactive = false) {
  const response = await apiClient.get(API.openSurvey.fields(eventId, includeInactive));
  return response.data;
}

export async function apiCreateField(eventId: number, dto: OpenSurveyFieldCreateDTO) {
  const response = await apiClient.post(API.openSurvey.createField(eventId), dto);
  return response.data;
}

export async function apiUpdateField(fieldId: number, dto: OpenSurveyFieldUpdateDTO) {
  const response = await apiClient.patch(API.openSurvey.field(fieldId), dto);
  return response.data;
}

export async function apiDeactivateField(fieldId: number) {
  const response = await apiClient.delete(API.openSurvey.field(fieldId));
  return response.data;
}
