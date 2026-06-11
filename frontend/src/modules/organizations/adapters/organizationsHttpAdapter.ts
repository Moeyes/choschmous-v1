/**
 * organizationsHttpAdapter.ts
 *
 * Concrete HTTP implementation of IOrganizationsRepository.
 * Every response is Zod-parsed with .strict() before leaving this file.
 */
import type { IOrganizationsRepository, OrganizationListParams } from '../ports/IOrganizationsRepository';
import { organizationPublicSchema, organizationsPublicSchema } from '../schema/organizations.schema';
import {
    apiGetOrganizations,
    apiGetOrganizationById,
    apiCreateOrganization,
    apiUpdateOrganization,
    apiDeleteOrganization,
} from '../api';
import type { OrganizationCreate, OrganizationUpdateBody } from '../types';

const DEFAULT_LIST_PARAMS: OrganizationListParams = { skip: 0, limit: 100 };

export const organizationsHttpAdapter: IOrganizationsRepository = {
    getAll: async (params?: OrganizationListParams) =>
        organizationsPublicSchema.parse(
            await apiGetOrganizations((params ?? DEFAULT_LIST_PARAMS) as Record<string, unknown>),
        ),

    getById: async (id: number) =>
        organizationPublicSchema.parse(await apiGetOrganizationById(id)),

    create: async (dto: OrganizationCreate) =>
        organizationPublicSchema.parse(await apiCreateOrganization(dto)),

    update: async (dto: OrganizationUpdateBody) =>
        organizationPublicSchema.parse(await apiUpdateOrganization(dto)),

    delete: async (id: number) => {
        await apiDeleteOrganization(id);
    },
};
