import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * Server response schemas — UNTRUSTED. Every payload that leaves the data layer
 * is parsed here (security baseline: validate at the adapter boundary).
 * ------------------------------------------------------------------------- */

// Event-picker option. We only need id + Khmer name (+ optional type) to let an
// org choose which event's open survey to fill. `survey_open_is_open` lets the
// picker defensively drop events whose open-survey phase is not live (the request
// is already filtered server-side via ?survey_open_open=true). Kept nullish so a
// future/absent flag never nukes the whole list.
export const openSurveyEventSchema = z.object({
  id: z.number(),
  name_kh: z.string(),
  type: z.string().nullish(),
  survey_open_is_open: z.boolean().nullish(),
});

export const openSurveyEventListResponseSchema = z.object({
  data: z.array(openSurveyEventSchema),
});

// One row of the org fill view (GET /api/surveys/open/responses).
//
// The backend's `OpenSurveyResponseWithField` now carries the full field shape:
//   id, field_id, organization_id, value, created_at, updated_at,
//   label_kh, label_en, field_type, options, required, sort_order
// `options`/`required`/`sort_order` are ALWAYS present (contract widened), so we
// parse them as required-from-server — `options` may still be null (a non-choice
// field has none). The response is untrusted regardless, so it is still `.parse`d.
// Rows arrive ordered by (sort_order, id); we re-sort defensively in the data
// layer (see `sortOpenSurveyFields`).
export const openSurveyFieldSchema = z.object({
  id: z.number(), // response-row id; 0 when this org has not answered yet
  field_id: z.number(), // the field id — the key used on submit
  organization_id: z.number(),
  value: z.string().nullable(), // null when unanswered
  field_type: z.string(),
  label_kh: z.string(),
  label_en: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  // Always sent now; `options` is null for non-choice fields.
  options: z.record(z.string(), z.unknown()).nullable(),
  required: z.boolean(),
  sort_order: z.number(),
});

export const openSurveyFillViewSchema = z.object({
  data: z.array(openSurveyFieldSchema),
  count: z.number().optional(),
});

// POST /api/surveys/open/responses returns list[OpenSurveyResponsePublic].
export const openSurveyResponseSchema = z.object({
  id: z.number(),
  field_id: z.number(),
  organization_id: z.number(),
  value: z.string().nullable(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export const openSurveyResponseListSchema = z.array(openSurveyResponseSchema);

export type OpenSurveyEvent = z.infer<typeof openSurveyEventSchema>;
export type OpenSurveyField = z.infer<typeof openSurveyFieldSchema>;
export type OpenSurveyResponse = z.infer<typeof openSurveyResponseSchema>;

/* ---------------------------------------------------------------------------
 * Submit payload — the single argument to the port's submitResponses().
 * ------------------------------------------------------------------------- */

export interface OpenSurveySubmitPayload {
  eventId: number;
  organizationId?: number;
  // Keyed by field_id. JSON serialises keys to strings; FastAPI coerces them
  // back to int (dict[int, str | None]).
  responses: Record<number, string | null>;
}

/* ---------------------------------------------------------------------------
 * Form schema — the form OUTPUT is untrusted too, so it is parsed (client UX
 * validation only; the server re-checks everything).
 * ------------------------------------------------------------------------- */

export interface OpenSurveyFormValues {
  responses: Record<string, string>;
}

// Per-field validation copy. Choice fields read better with a "select"-flavoured
// message than the generic "this field is required".
export interface OpenSurveyValidationMessages {
  required: string; // text / number fields
  selectOne: string; // select / dropdown / radio
  selectAtLeastOne: string; // checkbox (multi-select)
}

// Build a per-field Zod object so REQUIRED fields validate client-side. `required`
// is now always supplied by the server, so this gate is live; it is UX only — the
// server re-checks every answer regardless.
// The returned type is left inferred on purpose: a `z.object` over a
// Record-typed shape infers `{ responses: Record<string, string> }`, i.e.
// exactly OpenSurveyFormValues, with concrete input/output so zodResolver types
// cleanly. Annotating it as `z.ZodType<OpenSurveyFormValues>` would erase the
// input type to `unknown` and break the resolver overloads.
export function buildOpenSurveyFormSchema(
  fields: OpenSurveyField[],
  messages: OpenSurveyValidationMessages,
) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of fields) {
    if (!field.required) {
      shape[String(field.field_id)] = z.string();
      continue;
    }
    const control = choiceControlFor(field.field_type);
    const message =
      control === 'checkbox'
        ? messages.selectAtLeastOne
        : control !== null
          ? messages.selectOne
          : messages.required;
    shape[String(field.field_id)] = z.string().trim().min(1, message);
  }
  return z.object({ responses: z.object(shape) });
}

// Pre-fill: answered fields show their saved value; value=null shows empty.
export function fieldsToDefaults(fields: OpenSurveyField[]): OpenSurveyFormValues {
  const responses: Record<string, string> = {};
  for (const field of fields) {
    responses[String(field.field_id)] = field.value ?? '';
  }
  return { responses };
}

// Map RHF values back to the upsert payload keyed by field_id.
export function formValuesToPayload(
  values: OpenSurveyFormValues,
  fields: OpenSurveyField[],
  eventId: number,
  organizationId?: number,
): OpenSurveySubmitPayload {
  const responses: Record<number, string | null> = {};
  for (const field of fields) {
    const raw = values.responses[String(field.field_id)];
    responses[field.field_id] = raw === undefined ? null : raw;
  }
  return { eventId, organizationId, responses };
}

/* ---------------------------------------------------------------------------
 * Field ordering — applied in the data layer (adapter), never the component, so
 * the canonical order survives even if the server's ordering ever regresses.
 * Array.prototype.sort is stable (ES2019+); tie-break by field_id for determinism.
 * ------------------------------------------------------------------------- */

export function sortOpenSurveyFields(fields: OpenSurveyField[]): OpenSurveyField[] {
  return [...fields].sort(
    (a, b) => a.sort_order - b.sort_order || a.field_id - b.field_id,
  );
}

/* ---------------------------------------------------------------------------
 * Field-rendering helpers.
 *
 * The backend types `field_type` as a free-form String(50) (default "text") with
 * no enum, so the EXACT recognized values are defined here on the client:
 *   - choice controls: select | dropdown → 'select', radio → 'radio',
 *     checkbox → 'checkbox'
 *   - number → numeric input; everything else (incl. "text") → text input
 * ------------------------------------------------------------------------- */

export type OpenSurveyChoiceControl = 'select' | 'radio' | 'checkbox';

// Map a field_type to its choice control, or null for a free-text/number field.
export function choiceControlFor(fieldType: string): OpenSurveyChoiceControl | null {
  switch (fieldType.trim().toLowerCase()) {
    case 'select':
    case 'dropdown':
      return 'select';
    case 'radio':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    default:
      return null;
  }
}

export function htmlInputType(fieldType: string): string {
  return fieldType.trim().toLowerCase() === 'number' ? 'number' : 'text';
}

/* ---------------------------------------------------------------------------
 * Checkbox (multi-select) encoding. The backend stores ONE string per field
 * (value: str | None), so the selected option values are comma-joined into that
 * single string and split back on prefill — a reversible round-trip that needs no
 * backend change. Option values are admin-defined keys (no commas expected).
 * ------------------------------------------------------------------------- */

const CHECKBOX_DELIMITER = ',';

export function parseCheckboxSelection(value: string): string[] {
  return value
    .split(CHECKBOX_DELIMITER)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function joinCheckboxSelection(values: string[]): string {
  return values.join(CHECKBOX_DELIMITER);
}

// Khmer label is primary; English is the fallback when no Khmer label exists.
export function resolveFieldLabel(field: OpenSurveyField): string {
  return field.label_kh || field.label_en || '';
}

export interface OpenSurveyChoiceOption {
  value: string;
  label: string;
}

// Tolerant options extractor. The fill view does NOT currently send `options`,
// so this returns null today and every field renders as a text input. If/when
// the contract grows it handles the common shapes: a `choices` array (of strings
// or { value, label }) or a flat { value: label } object.
export function extractFieldOptions(field: OpenSurveyField): OpenSurveyChoiceOption[] | null {
  const options = field.options;
  if (!options) return null;

  const fromArray = (arr: unknown[]): OpenSurveyChoiceOption[] =>
    arr
      .map((item): OpenSurveyChoiceOption | null => {
        if (typeof item === 'string') return { value: item, label: item };
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const value = typeof obj.value === 'string' ? obj.value : undefined;
          const label = typeof obj.label === 'string' ? obj.label : value;
          if (value) return { value, label: label ?? value };
        }
        return null;
      })
      .filter((option): option is OpenSurveyChoiceOption => option !== null);

  const choices = (options as Record<string, unknown>).choices;
  if (Array.isArray(choices)) {
    const result = fromArray(choices);
    return result.length > 0 ? result : null;
  }

  const entries = Object.entries(options).filter(([, v]) => typeof v === 'string');
  if (entries.length > 0) {
    return entries.map(([key, value]) => ({ value: key, label: String(value) }));
  }
  return null;
}
