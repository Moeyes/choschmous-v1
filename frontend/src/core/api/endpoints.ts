export const API = {
    events: {
        base: '/api/events',
        byId: (id: number) => `/api/events/${id}`,
        publicById: (id: number) => `/api/public/events/${id}`,
        sports: (eventId: number) => `/api/events/${eventId}/sports`,
        sportOrgs: (eventId: number, sportId: number) => `/api/events/${eventId}/sports/${sportId}/orgs`,
        sportCategories: (eventId: number, sportId: number) => `/api/events/${eventId}/sports/${sportId}/categories`,
        myEligibleSports: (eventId: number) => `/api/events/${eventId}/my-eligible-sports`,
        organizations: (eventId: number) => `/api/events/${eventId}/organizations`,
        addOrgToSport: '/api/events/add-org-to-sport',
        deleteOrgLink: '/api/events/delete-event-sport-org-link',
        removeOrgCompletely: '/api/events/remove-org-completely-from-event',
        list: '/api/events?skip=0&limit=100',
        phase: (id: number) => `/api/events/${id}/phase`,
        delete: '/api/events/delete',
        surveyStatus: (id: number) => `/api/events/${id}/survey-status`,
    },
    sportsEvents: {
        base: '/api/sports-events',
        byId: (id: number) => `/api/sports-events/${id}`,
        config: (id: number) => `/api/sports-events/${id}/config`,
    },
    sports: {
        base: '/api/sports',
        byId: (id: number) => `/api/sports/${id}`,
        categories: (sportId: number) => `/api/sports/${sportId}/categories`,
        category: '/api/sports/category',
        list: '/api/sports?skip=0&limit=200',
        listLimited: '/api/sports?limit=200',
    },
    organizations: {
        base: '/api/organization',
        byId: (id: number) => `/api/organization/${id}`,
        update: '/api/organization/update',
        delete: '/api/organization/delete',
        list: '/api/organization?skip=0&limit=100',
    },
    users: {
        base: '/api/users',
        byId: (id: string) => `/api/users/${id}`,
        update: '/api/users/update',
        delete: '/api/users/delete',
    },
    registration: {
        base: '/api/registration',
        search: '/api/registration/search',
        byId: (id: number) => `/api/registration/${id}`,
        reveal: (id: number) => `/api/registration/${id}/reveal`,
        update: '/api/registration/update',
        delete: '/api/registration/delete',
    },
    participation: {
        base: '/api/participation-per-sport',
        byId: (id: number) => `/api/participation-per-sport/${id}`,
        review: (id: number) => `/api/participation-per-sport/${id}/review`,
    },
    // By-sport admin review queue (submission = sports_event_org row).
    sportSubmissions: {
        list: '/api/events/sport-org/submissions',
        review: (id: number) => `/api/events/sport-org/${id}/review`,
    },
    // By-category admin review queue (submission = categories for an event+sport).
    categorySubmissions: {
        list: '/api/surveys/category/submissions',
        byId: (id: number) => `/api/surveys/category/submissions/${id}`,
        review: (id: number) => `/api/surveys/category/submissions/${id}/review`,
    },
    survey: {
        events: '/api/events?survey_sport_open=true&skip=0&limit=100',
        sports: '/api/sports?skip=0&limit=200',
        organizations: '/api/organization?skip=0&limit=100',
        eventSports: (eventId: number) => `/api/events/${eventId}/sports`,
        orgSports: (eventId: number, orgId: number) => `/api/events/${eventId}/org-sports/${orgId}`,
        addOrgToSport: '/api/events/add-org-to-sport',
    },
    bynumber: {
        events: '/api/events?survey_number_open=true&skip=0&limit=100',
        sports: '/api/sports?skip=0&limit=200',
        organizations: '/api/organization?skip=0&limit=100',
        eventSports: (eventId: number) => `/api/events/${eventId}/sports`,
        sportOrgs: (eventId: number, sportId: number) => `/api/events/${eventId}/sports/${sportId}/orgs`,
        sportsList: '/api/sports?limit=200',
        createParticipation: '/api/participation-per-sport',
    },
    dashboard: {
        data: '/api/dashboard',
    },
    reports: {
        generate: (key: string) => `/api/reports/${key}`,
    },

    cards: {
        byId: (pId: string, orgId: string, eventId: string) => `/api/card/${pId}/${orgId}/${eventId}`,
        list: (orgId: string, eventId: string) => `/api/cards/${orgId}/${eventId}`,
    },
    participant: {
        base: '/api/registration',
    },
    organizer: {
        register: '/api/registration/organizer',
        roles: '/api/organizer-roles',
        roleById: (id: number) => `/api/organizer-roles/${id}`,
    },
    bycategory: {
        eligibleEvents: '/api/events?survey_category_open=true&skip=0&limit=100',
        categories: (eventId: number, sportId: number) =>
            `/api/surveys/category?event_id=${eventId}&sport_id=${sportId}`,
        upsert: '/api/surveys/category',
    },
    openSurvey: {
        events: '/api/events?skip=0&limit=100',
        // Shared by GET (fill view) and POST (upsert). organization_id is ignored
        // server-side for ORG users (forced to their own org). No PII in the URL.
        responses: (eventId: number, organizationId?: number) =>
            `/api/surveys/open/responses?event_id=${eventId}` +
            (organizationId ? `&organization_id=${organizationId}` : ''),
        // Admin field management (producer side). GET lists an event's fields,
        // POST (createField URL) adds one. Only event_id/field_id in the URL — no PII.
        fields: (eventId: number, includeInactive = false) =>
            `/api/surveys/open/fields?event_id=${eventId}` +
            (includeInactive ? '&include_inactive=true' : ''),
        createField: (eventId: number) => `/api/surveys/open/fields?event_id=${eventId}`,
        field: (fieldId: number) => `/api/surveys/open/fields/${fieldId}`,
    },
} as const;
