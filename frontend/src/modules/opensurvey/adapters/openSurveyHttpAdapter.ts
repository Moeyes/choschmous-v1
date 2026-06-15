import type { IOpenSurveyRepository } from '../ports/IOpenSurveyRepository';
import {
  openSurveyEventListResponseSchema,
  openSurveyFillViewSchema,
  openSurveyResponseListSchema,
  sortOpenSurveyFields,
} from '../schema/opensurvey.schema';
import {
  openSurveyFieldDefListSchema,
  openSurveyFieldDefSchema,
} from '../schema/openSurveyField.schema';
import {
  apiCreateField,
  apiDeactivateField,
  apiGetEvents,
  apiGetFillView,
  apiListFields,
  apiSubmitResponses,
  apiUpdateField,
} from '../api';

export const openSurveyHttpAdapter: IOpenSurveyRepository = {
  async fetchEvents() {
    try {
      const raw = await apiGetEvents();
      const events = openSurveyEventListResponseSchema.parse(raw).data;
      // Belt-and-suspenders: the request is already filtered server-side, but
      // drop any event whose open-survey phase isn't live so orgs can't pick it.
      return events.filter((event) => event.survey_open_is_open !== false);
    } catch {
      // Reads degrade to an empty list so the UI shows an empty state instead
      // of crashing. (Writes below intentionally do NOT swallow — see submit.)
      return [];
    }
  },

  async getFillView(eventId, organizationId) {
    try {
      const raw = await apiGetFillView(eventId, organizationId);
      // Sort defensively in the data layer (not the component) by sort_order asc.
      return sortOpenSurveyFields(openSurveyFillViewSchema.parse(raw).data);
    } catch {
      return [];
    }
  },

  async submitResponses(payload) {
    // Must NOT swallow: the mutation needs the error (esp. a 403 phase-closed)
    // to reach its onError handler. The success payload is still parsed.
    const raw = await apiSubmitResponses(payload.eventId, payload.responses, payload.organizationId);
    return openSurveyResponseListSchema.parse(raw);
  },

  /* ---- Admin field management (producer) -------------------------------- */
  // Unlike the org reads above, these do NOT swallow errors: the admin builder
  // surfaces load/save failures (react-query isError / the mutation onError).

  async listFields(eventId, includeInactive = false) {
    const raw = await apiListFields(eventId, includeInactive);
    return openSurveyFieldDefListSchema.parse(raw).data;
  },

  async createField(eventId, dto) {
    return openSurveyFieldDefSchema.parse(await apiCreateField(eventId, dto));
  },

  async updateField(fieldId, dto) {
    return openSurveyFieldDefSchema.parse(await apiUpdateField(fieldId, dto));
  },

  async deactivateField(fieldId) {
    return openSurveyFieldDefSchema.parse(await apiDeactivateField(fieldId));
  },

  async reorderFields(items) {
    // No bulk-reorder endpoint server-side, so persist each changed field's
    // sort_order via PATCH. Awaited together so the caller can invalidate once.
    await Promise.all(
      items.map((item) => apiUpdateField(item.fieldId, { sort_order: item.sortOrder })),
    );
  },
};
