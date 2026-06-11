import type { ISportsRepository, SportListParams, SportParticipantsParams } from '../ports/ISportsRepository';
import {
    sportPublicSchema, sportsPublicSchema,
    categoryPublicSchema, categoriesPublicSchema,
    sportParticipantsPublicSchema,
} from '../schema/sports.schema';
import {
    apiGetSports, apiGetSportById, apiCreateSport, apiUpdateSport, apiDeleteSport,
    apiGetCategoriesBySportId, apiGetCategoryById,
    apiAddCategory, apiUpdateCategory, apiDeleteCategory,
    apiGetParticipants,
} from '../api';
import type { SportCreate, SportUpdate, AddCategoryBody, UpdateCategoryBody, DeleteCategoryBody } from '../types';

const DEFAULT_LIST_PARAMS: SportListParams = { skip: 0, limit: 200 };

export const sportsHttpAdapter: ISportsRepository = {
    getAll: async (params?: SportListParams) =>
        sportsPublicSchema.parse(
            await apiGetSports((params ?? DEFAULT_LIST_PARAMS) as Record<string, unknown>),
        ),

    getById: async (id: number) =>
        sportPublicSchema.parse(await apiGetSportById(id)),

    create: async (dto: SportCreate) =>
        sportPublicSchema.parse(await apiCreateSport(dto)),

    update: async (dto: SportUpdate) =>
        sportPublicSchema.parse(await apiUpdateSport(dto)),

    delete: async (id: number) => {
        await apiDeleteSport(id);
    },

    getCategoriesBySportId: async (sportId: number) =>
        categoriesPublicSchema.parse(await apiGetCategoriesBySportId(sportId)),

    getCategoryById: async (id: number) =>
        categoryPublicSchema.parse(await apiGetCategoryById(id)),

    addCategory: async (dto: AddCategoryBody) =>
        categoryPublicSchema.parse(await apiAddCategory(dto)),

    updateCategory: async (dto: UpdateCategoryBody) =>
        categoryPublicSchema.parse(await apiUpdateCategory(dto)),

    deleteCategory: async (dto: DeleteCategoryBody) => {
        await apiDeleteCategory(dto);
    },

    getParticipants: async (params: SportParticipantsParams) => {
        const { sportId, role, eventId, organizationId, limit } = params;
        return sportParticipantsPublicSchema.parse(
            await apiGetParticipants({
                role,
                sport_id: sportId,
                event_id: eventId,
                organization_id: organizationId,
                limit: limit ?? 200,
            }),
        );
    },
};
