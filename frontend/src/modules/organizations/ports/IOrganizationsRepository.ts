/**
 * IOrganizationsRepository
 *
 * Declares what the organizations module needs from the data layer — not how it
 * is fetched. Hooks depend only on this interface; swapping HTTP ↔ mock adapter
 * requires changing exactly one line in adapters/index.ts.
 */
import type { OrganizationPublic, OrganizationsPublic } from '../schema/organizations.schema';
import type { OrganizationCreate, OrganizationUpdateBody } from '../types';

export interface OrganizationListParams {
    skip?:  number;
    limit?: number;
    name?:  string;
}

export interface IOrganizationsRepository {
    getAll(params?: OrganizationListParams): Promise<OrganizationsPublic>;
    getById(id: number): Promise<OrganizationPublic>;
    create(dto: OrganizationCreate): Promise<OrganizationPublic>;
    update(dto: OrganizationUpdateBody): Promise<OrganizationPublic>;
    delete(id: number): Promise<void>;
}
