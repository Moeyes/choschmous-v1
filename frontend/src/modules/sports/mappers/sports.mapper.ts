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
    return {
        sport_id: sportId,
        category: values.category,
        gender:   values.gender ?? null,
    };
}

export function formDataToUpdateCategory(id: number, sportId: number, values: CategoryFormValues): UpdateCategoryBody {
    return {
        id,
        sport_id: sportId,
        category: values.category,
        gender:   values.gender ?? null,
    };
}
