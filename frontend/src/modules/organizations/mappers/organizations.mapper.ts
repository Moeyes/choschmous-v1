/**
 * organizations.mapper.ts
 *
 * form values → API DTOs. Keeps coercion logic out of components.
 * Reproduces the exact payloads OrgForm submitted before the refactor
 * (optional text fields are passed through as the form holds them).
 */
import type { OrgFormValues } from '../schema/organizations.schema';
import type { OrganizationCreate, OrganizationUpdateBody } from '../types';

export function formDataToCreateDto(values: OrgFormValues): OrganizationCreate {
    return {
        name_kh: values.name_kh,
        name_en: values.name_en,
        type:    values.type,
    };
}

export function formDataToUpdateDto(id: number, values: OrgFormValues): OrganizationUpdateBody {
    return {
        id,
        name_kh: values.name_kh,
        name_en: values.name_en,
        type:    values.type,
    };
}
