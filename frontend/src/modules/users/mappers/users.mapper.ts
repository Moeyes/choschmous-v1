/**
 * users.mapper.ts
 *
 * form values → API DTOs. Keeps coercion logic out of components.
 * Role-binding rules mirror the backend UserCreate validator.
 */
import { UserRole } from '@/core/auth';
import type { UserFormValues } from '../schema/users.schema';
import type { UserCreate, UserUpdate } from '../types';

export function formDataToCreateDto(values: UserFormValues): UserCreate {
    const { sport_id, organization_id } = resolveBindings(values.role, values.sport_id, values.organization_id);
    return {
        username:        values.username,
        email:           values.email,
        password:        values.password || 'password123',
        kh_family_name:  values.kh_family_name,
        kh_given_name:   values.kh_given_name,
        en_family_name:  values.en_family_name,
        en_given_name:   values.en_given_name,
        role:            values.role,
        sport_id,
        organization_id,
    };
}

export function formDataToUpdateDto(id: string, values: UserFormValues): UserUpdate {
    const { sport_id, organization_id } = resolveBindings(values.role, values.sport_id, values.organization_id);
    const dto: UserUpdate = {
        id,
        username:        values.username,
        email:           values.email,
        kh_family_name:  values.kh_family_name,
        kh_given_name:   values.kh_given_name,
        en_family_name:  values.en_family_name,
        en_given_name:   values.en_given_name,
        role:            values.role,
        sport_id,
        organization_id,
    };
    if (values.password) dto.password = values.password;
    return dto;
}

function resolveBindings(
    role: UserRole,
    rawSportId: UserFormValues['sport_id'],
    rawOrgId:   UserFormValues['organization_id'],
): { sport_id: number | null; organization_id: number | null } {
    if (role === UserRole.FEDERATION)   return { sport_id: rawSportId  ? Number(rawSportId)  : null, organization_id: null };
    if (role === UserRole.ORGANIZATION) return { sport_id: null, organization_id: rawOrgId ? Number(rawOrgId) : null };
    return { sport_id: null, organization_id: null };
}
