import { z } from 'zod';

/* ===========================================================================
 * ADMIN field-definition schema — the PRODUCER side of the open survey.
 *
 * Admins define the fields; orgs fill them (the consumer renderer lives in
 * `OpenSurveyFieldInput.tsx` / `choiceControlFor` in `opensurvey.schema.ts`).
 * Everything here is kept deliberately aligned with that renderer so a field an
 * admin builds renders the way they expect for orgs.
 * ========================================================================= */

/* ---------------------------------------------------------------------------
 * Field-type vocabulary — MUST match the org renderer EXACTLY.
 *
 * `choiceControlFor` / `htmlInputType` in `opensurvey.schema.ts` recognise only
 * these five strings; ANY other value falls back to a free-text box for orgs.
 * The builder must therefore offer ONLY these and emit these exact strings —
 * no "dropdown" alias, no "longtext", etc.
 * ------------------------------------------------------------------------- */
export const OPEN_SURVEY_FIELD_TYPES = ['text', 'number', 'select', 'radio', 'checkbox'] as const;
export type OpenSurveyFieldType = (typeof OPEN_SURVEY_FIELD_TYPES)[number];

// The choice types: these REQUIRE options. (text / number must NOT carry options.)
export const OPEN_SURVEY_CHOICE_FIELD_TYPES = ['select', 'radio', 'checkbox'] as const;

export function isChoiceFieldType(fieldType: OpenSurveyFieldType): boolean {
  return (OPEN_SURVEY_CHOICE_FIELD_TYPES as readonly string[]).includes(fieldType);
}

/**
 * Comma is reserved. The org checkbox renderer encodes a multi-select answer as
 * a comma-joined string (see `joinCheckboxSelection`), so a comma inside an
 * option VALUE would corrupt that round-trip. Labels are display-only and may
 * contain anything — only values are constrained.
 */
export const OPEN_SURVEY_OPTION_DELIMITER = ',';

/* ---------------------------------------------------------------------------
 * Server response — UNTRUSTED. Parsed at the adapter boundary.
 * Matches backend `OpenSurveyFieldPublic`.
 * ------------------------------------------------------------------------- */
export const openSurveyFieldDefSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  label_kh: z.string(),
  label_en: z.string().nullish(),
  // Server types this as a free-form String(50); normalise to the known
  // vocabulary in the UI via `normalizeFieldType`.
  field_type: z.string(),
  options: z.record(z.string(), z.unknown()).nullable(),
  required: z.boolean(),
  sort_order: z.number(),
  active: z.boolean(),
  created_at: z.string().nullish(),
});

export const openSurveyFieldDefListSchema = z.object({
  data: z.array(openSurveyFieldDefSchema),
  count: z.number().optional(),
});

export type OpenSurveyFieldDef = z.infer<typeof openSurveyFieldDefSchema>;

/* ---------------------------------------------------------------------------
 * DTOs sent to the admin endpoints.
 * ------------------------------------------------------------------------- */
export interface OpenSurveyFieldOptionInput {
  value: string;
  label: string;
}

// Stored options shape. We always persist the `{ choices: [...] }` form, which
// the org renderer's `extractFieldOptions` reads back as { value, label } pairs.
export interface OpenSurveyFieldOptions {
  choices: OpenSurveyFieldOptionInput[];
}

export interface OpenSurveyFieldCreateDTO {
  label_kh: string;
  label_en: string | null;
  field_type: OpenSurveyFieldType;
  options: OpenSurveyFieldOptions | null;
  required: boolean;
  sort_order: number;
}

// Partial — the backend PATCH applies only the keys present (exclude_unset).
export interface OpenSurveyFieldUpdateDTO {
  label_kh?: string;
  label_en?: string | null;
  field_type?: OpenSurveyFieldType;
  options?: OpenSurveyFieldOptions | null;
  required?: boolean;
  sort_order?: number;
  active?: boolean;
}

// One field's new position. Reorder is persisted as per-field sort_order PATCHes
// (there is no bulk-reorder endpoint server-side).
export interface OpenSurveyFieldReorderItem {
  fieldId: number;
  sortOrder: number;
}

/* ---------------------------------------------------------------------------
 * Builder form values + validation.
 * ------------------------------------------------------------------------- */
export interface OpenSurveyFieldFormValues {
  label_kh: string;
  label_en: string;
  field_type: OpenSurveyFieldType;
  options: OpenSurveyFieldOptionInput[];
  required: boolean;
  active: boolean;
  sort_order: number;
}

export interface OpenSurveyFieldValidationMessages {
  labelKhRequired: string;
  optionsRequired: string;
  optionEmpty: string;
  optionDuplicate: string;
  optionComma: string;
}

const optionInputSchema = z.object({
  value: z.string(),
  label: z.string(),
});

/**
 * Builds the field-definition form schema. Choice types (select/radio/checkbox)
 * require ≥1 option; each option value must be non-empty, unique within the
 * field, and comma-free (the checkbox round-trip constraint). text/number carry
 * no options (the mapper nulls them, so they are not validated here).
 */
export function buildOpenSurveyFieldFormSchema(messages: OpenSurveyFieldValidationMessages) {
  return z
    .object({
      label_kh: z.string().trim().min(1, messages.labelKhRequired),
      label_en: z.string().trim(),
      field_type: z.enum(OPEN_SURVEY_FIELD_TYPES),
      options: z.array(optionInputSchema),
      required: z.boolean(),
      active: z.boolean(),
      sort_order: z.number().int(),
    })
    .superRefine((values, ctx) => {
      if (!isChoiceFieldType(values.field_type)) return;

      if (values.options.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: messages.optionsRequired });
        return;
      }

      const seen = new Set<string>();
      values.options.forEach((option, index) => {
        const value = option.value.trim();
        if (value.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', index, 'value'], message: messages.optionEmpty });
          return;
        }
        if (value.includes(OPEN_SURVEY_OPTION_DELIMITER)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', index, 'value'], message: messages.optionComma });
        }
        if (seen.has(value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options', index, 'value'], message: messages.optionDuplicate });
        }
        seen.add(value);
      });
    });
}

/* ---------------------------------------------------------------------------
 * Options codec (form ⇄ stored dict).
 *
 * NOTE: deliberately separate from the renderer's tolerant `extractFieldOptions`
 * — that one targets the org fill-view field shape and only needs display data,
 * whereas the builder must preserve a distinct value + label for round-trip
 * editing. Both understand the same `{ choices: [...] }` wire shape.
 * ------------------------------------------------------------------------- */
export function fieldOptionsToInputs(options: Record<string, unknown> | null): OpenSurveyFieldOptionInput[] {
  if (!options) return [];

  const choices = (options as { choices?: unknown }).choices;
  if (Array.isArray(choices)) {
    return choices
      .map((item): OpenSurveyFieldOptionInput | null => {
        if (typeof item === 'string') return { value: item, label: item };
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const value = typeof obj.value === 'string' ? obj.value : undefined;
          if (!value) return null;
          const label = typeof obj.label === 'string' && obj.label.length > 0 ? obj.label : value;
          return { value, label };
        }
        return null;
      })
      .filter((option): option is OpenSurveyFieldOptionInput => option !== null);
  }

  // Tolerate a flat { value: label } object.
  return Object.entries(options)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => ({ value: key, label: String(value) }));
}

export function inputsToFieldOptions(options: OpenSurveyFieldOptionInput[]): OpenSurveyFieldOptions {
  return {
    choices: options.map((option) => {
      const value = option.value.trim();
      const label = option.label.trim();
      // Label defaults to the value so orgs always see something readable.
      return { value, label: label.length > 0 ? label : value };
    }),
  };
}

/* ---------------------------------------------------------------------------
 * Mappers: existing field → form defaults, and form values → DTOs.
 * ------------------------------------------------------------------------- */

/**
 * Coerce a free-form server `field_type` to the known vocabulary. 'dropdown' is
 * the renderer's legacy alias for 'select'; any unrecognised type renders as
 * text for orgs, so it is surfaced as 'text' here too. The builder only ever
 * emits the five canonical values.
 */
export function normalizeFieldType(fieldType: string): OpenSurveyFieldType {
  const normalized = fieldType.trim().toLowerCase();
  if (normalized === 'dropdown') return 'select';
  return (OPEN_SURVEY_FIELD_TYPES as readonly string[]).includes(normalized)
    ? (normalized as OpenSurveyFieldType)
    : 'text';
}

export function fieldToFormValues(
  field: OpenSurveyFieldDef | undefined,
  nextSortOrder: number,
): OpenSurveyFieldFormValues {
  if (!field) {
    return {
      label_kh: '',
      label_en: '',
      field_type: 'text',
      options: [],
      required: true,
      active: true,
      sort_order: nextSortOrder,
    };
  }
  return {
    label_kh: field.label_kh,
    label_en: field.label_en ?? '',
    field_type: normalizeFieldType(field.field_type),
    options: fieldOptionsToInputs(field.options),
    required: field.required,
    active: field.active,
    sort_order: field.sort_order,
  };
}

export function formValuesToCreateDto(values: OpenSurveyFieldFormValues): OpenSurveyFieldCreateDTO {
  const choice = isChoiceFieldType(values.field_type);
  return {
    label_kh: values.label_kh.trim(),
    label_en: values.label_en.trim() ? values.label_en.trim() : null,
    field_type: values.field_type,
    options: choice ? inputsToFieldOptions(values.options) : null,
    required: values.required,
    sort_order: values.sort_order,
  };
}

export function formValuesToUpdateDto(values: OpenSurveyFieldFormValues): OpenSurveyFieldUpdateDTO {
  const choice = isChoiceFieldType(values.field_type);
  return {
    label_kh: values.label_kh.trim(),
    label_en: values.label_en.trim() ? values.label_en.trim() : null,
    field_type: values.field_type,
    options: choice ? inputsToFieldOptions(values.options) : null,
    required: values.required,
    active: values.active,
    sort_order: values.sort_order,
  };
}
