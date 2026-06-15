import type {
  OpenSurveyEvent,
  OpenSurveyField,
  OpenSurveyResponse,
  OpenSurveySubmitPayload,
} from '../schema/opensurvey.schema';
import type {
  OpenSurveyFieldCreateDTO,
  OpenSurveyFieldDef,
  OpenSurveyFieldReorderItem,
  OpenSurveyFieldUpdateDTO,
} from '../schema/openSurveyField.schema';

/**
 * Open-survey port — the contract both the org-facing fill module (consumer) and
 * the admin field-builder (producer) depend on. All HTTP for this module sits
 * behind this interface; hooks/components import the registered adapter from
 * `../adapters`, never a concrete adapter or fetch.
 */
export interface IOpenSurveyRepository {
  /* ---- Org fill (consumer) ---------------------------------------------- */
  /** Events the org can pick to fill an open survey for. */
  fetchEvents(): Promise<OpenSurveyEvent[]>;
  /**
   * The org's fill view: every active field merged with this org's current
   * answer (value=null when unanswered). Readable even when the phase is closed.
   */
  getFillView(eventId: number, organizationId?: number): Promise<OpenSurveyField[]>;
  /** Upsert this org's answers. Phase-gated server-side (403 when closed). */
  submitResponses(payload: OpenSurveySubmitPayload): Promise<OpenSurveyResponse[]>;

  /* ---- Admin field management (producer; admin-only server-side) --------- */
  /** List an event's field definitions, ordered by sort_order. */
  listFields(eventId: number, includeInactive?: boolean): Promise<OpenSurveyFieldDef[]>;
  /** Add one field definition to an event. */
  createField(eventId: number, dto: OpenSurveyFieldCreateDTO): Promise<OpenSurveyFieldDef>;
  /** Partially update a field definition. */
  updateField(fieldId: number, dto: OpenSurveyFieldUpdateDTO): Promise<OpenSurveyFieldDef>;
  /** Soft-delete a field (active=false); existing org answers are preserved. */
  deactivateField(fieldId: number): Promise<OpenSurveyFieldDef>;
  /** Persist a new field order (per-field sort_order PATCHes). */
  reorderFields(items: OpenSurveyFieldReorderItem[]): Promise<void>;
}
