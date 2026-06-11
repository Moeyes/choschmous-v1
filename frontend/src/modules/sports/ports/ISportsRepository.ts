import type { SportPublic, SportsPublic } from '../schema/sports.schema';
import type { CategoryPublic, CategoriesPublic } from '../schema/sports.schema';
import type { SportParticipantsPublic } from '../schema/sports.schema';
import type {
    SportCreate, SportUpdate,
    AddCategoryBody, UpdateCategoryBody, DeleteCategoryBody,
    ParticipantRole,
} from '../types';

export interface SportListParams {
    skip?:  number;
    limit?: number;
}

export interface SportParticipantsParams {
    role:            ParticipantRole;
    sportId:         number;
    eventId?:        number;
    organizationId?: number;
    limit?:          number;
}

export interface ISportsRepository {
    getAll(params?: SportListParams): Promise<SportsPublic>;
    getById(id: number): Promise<SportPublic>;
    create(dto: SportCreate): Promise<SportPublic>;
    update(dto: SportUpdate): Promise<SportPublic>;
    delete(id: number): Promise<void>;

    getCategoriesBySportId(sportId: number): Promise<CategoriesPublic>;
    getCategoryById(id: number): Promise<CategoryPublic>;
    addCategory(dto: AddCategoryBody): Promise<CategoryPublic>;
    updateCategory(dto: UpdateCategoryBody): Promise<CategoryPublic>;
    deleteCategory(dto: DeleteCategoryBody): Promise<void>;

    getParticipants(params: SportParticipantsParams): Promise<SportParticipantsPublic>;
}
