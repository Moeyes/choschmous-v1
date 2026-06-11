import type { EventFormValues } from '../schema/events.schema';
import type { EventCreate, EventUpdate } from '../types';

export function formDataToCreateDto(values: EventFormValues): EventCreate {
    return {
        name:        values.name,
        description: values.description,
        start_date:  values.start_date,
        end_date:    values.end_date,
        event_type:  values.event_type,
        location:    values.location,
        age_mode:    values.age_mode,
        age_min:     Number(values.age_min),
        age_max:     Number(values.age_max),

        survey_category_status: values.survey_category_status,
        survey_category_open_date: values.survey_category_open_date || null,
        survey_category_close_date: values.survey_category_close_date || null,
        survey_sport_status: values.survey_sport_status,
        survey_sport_open_date: values.survey_sport_open_date || null,
        survey_sport_close_date: values.survey_sport_close_date || null,
        survey_number_status: values.survey_number_status,
        survey_number_open_date: values.survey_number_open_date || null,
        survey_number_close_date: values.survey_number_close_date || null,
        registration_status: values.registration_status,
        registration_open_date: values.registration_open_date || null,
        registration_close_date: values.registration_close_date || null,
    };
}

export function formDataToUpdateDto(id: number, values: EventFormValues): EventUpdate {
    return {
        id,
        name:        values.name,
        description: values.description,
        start_date:  values.start_date,
        end_date:    values.end_date,
        event_type:  values.event_type,
        location:    values.location,
        age_mode:    values.age_mode,
        age_min:     Number(values.age_min),
        age_max:     Number(values.age_max),

        survey_category_status: values.survey_category_status,
        survey_category_open_date: values.survey_category_open_date || null,
        survey_category_close_date: values.survey_category_close_date || null,
        survey_sport_status: values.survey_sport_status,
        survey_sport_open_date: values.survey_sport_open_date || null,
        survey_sport_close_date: values.survey_sport_close_date || null,
        survey_number_status: values.survey_number_status,
        survey_number_open_date: values.survey_number_open_date || null,
        survey_number_close_date: values.survey_number_close_date || null,
        registration_status: values.registration_status,
        registration_open_date: values.registration_open_date || null,
        registration_close_date: values.registration_close_date || null,
    };
}
