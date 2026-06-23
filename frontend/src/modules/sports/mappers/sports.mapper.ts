import type { SportFormValues, CategoryFormValues } from '../schema/sports.schema';
import type { SportCreate, SportUpdate } from '../types';
import type { AddCategoryBody, UpdateCategoryBody } from '../types';

export function formDataToCreateSport(values: SportFormValues): SportCreate {
    return {
        name_kh:    values.name_kh,
        sport_type: values.sport_type || undefined,
    };
}

export function formDataToUpdateSport(id: number, values: SportFormValues): SportUpdate {
    return {
        id,
        name_kh:    values.name_kh,
        sport_type: values.sport_type || undefined,
    };
}

export function formDataToAddCategory(sportId: number, values: CategoryFormValues): AddCategoryBody {
    const isTeam = values.categoryType === 'team';
    return {
        sport_id:      sportId,
        category:      values.category,
        gender:        values.gender ?? null,
        team_size_min: isTeam ? values.team_size_min ?? null : null,
        team_size_max: isTeam ? values.team_size_max ?? null : null,
    };
}

export function formDataToUpdateCategory(id: number, sportId: number, values: CategoryFormValues): UpdateCategoryBody {
    const isTeam = values.categoryType === 'team';
    return {
        id,
        sport_id:      sportId,
        category:      values.category,
        gender:        values.gender ?? null,
        team_size_min: isTeam ? values.team_size_min ?? null : null,
        team_size_max: isTeam ? values.team_size_max ?? null : null,
    };
}
