// CHOS-203: the backend API prefix is now versioned (/api/v1). Every path below
// targets this canonical prefix. Legacy /api/* paths still resolve via a 307
// redirect on the server, but the client should always hit /api/v1 directly.
export const API = {
  // CHOS-304: global search powering the ⌘K palette. POST so the query (which
  // may contain a person's name) never lands in a URL/history/access log.
  search: {
    base: '/api/v1/search',
  },
  events: {
    base: '/api/v1/events',
    byId: (id: number) => `/api/v1/events/${id}`,
    publicById: (id: number) => `/api/v1/public/events/${id}`,
    sports: (eventId: number) => `/api/v1/events/${eventId}/sports`,
    sportOrgs: (eventId: number, sportId: number) => `/api/v1/events/${eventId}/sports/${sportId}/orgs`,
    sportCategories: (eventId: number, sportId: number) => `/api/v1/events/${eventId}/sports/${sportId}/categories`,
    myEligibleSports: (eventId: number) => `/api/v1/events/${eventId}/my-eligible-sports`,
    organizations: (eventId: number) => `/api/v1/events/${eventId}/organizations`,
    addOrgToSport: '/api/v1/events/add-org-to-sport',
    deleteOrgLink: '/api/v1/events/delete-event-sport-org-link',
    removeOrgCompletely: '/api/v1/events/remove-org-completely-from-event',
    list: '/api/v1/events?skip=0&limit=100',
    phase: (id: number) => `/api/v1/events/${id}/phase`,
    delete: '/api/v1/events/delete',
    surveyStatus: (id: number) => `/api/v1/events/${id}/survey-status`,
  },
  sportsEvents: {
    base: '/api/v1/sports-events',
    byId: (id: number) => `/api/v1/sports-events/${id}`,
    config: (id: number) => `/api/v1/sports-events/${id}/config`,
  },
  sports: {
    base: '/api/v1/sports',
    byId: (id: number) => `/api/v1/sports/${id}`,
    categories: (sportId: number) => `/api/v1/sports/${sportId}/categories`,
    category: '/api/v1/sports/category',
    list: '/api/v1/sports?skip=0&limit=200',
    listLimited: '/api/v1/sports?limit=200',
  },
  organizations: {
    base: '/api/v1/organization',
    byId: (id: number) => `/api/v1/organization/${id}`,
    update: '/api/v1/organization/update',
    delete: '/api/v1/organization/delete',
    list: '/api/v1/organization?skip=0&limit=100',
  },
  users: {
    base: '/api/v1/users',
    byId: (id: string) => `/api/v1/users/${id}`,
    update: '/api/v1/users/update',
    delete: '/api/v1/users/delete',
  },
  registration: {
    base: '/api/v1/registration',
    search: '/api/v1/registration/search',
    byId: (id: number) => `/api/v1/registration/${id}`,
    reveal: (id: number) => `/api/v1/registration/${id}/reveal`,
    update: '/api/v1/registration/update',
    delete: '/api/v1/registration/delete',
  },
  participation: {
    base: '/api/v1/participation-per-sport',
    byId: (id: number) => `/api/v1/participation-per-sport/${id}`,
    review: (id: number) => `/api/v1/participation-per-sport/${id}/review`,
    reviewOrg: (orgId: number) => `/api/v1/participation-per-sport/org/${orgId}/review`,
  },
  // By-sport admin review queue (submission = sports_event_org row).
  sportSubmissions: {
    list: '/api/v1/events/sport-org/submissions',
    review: (id: number) => `/api/v1/events/sport-org/${id}/review`,
    reviewOrg: (orgId: number) => `/api/v1/events/sport-org/org/${orgId}/review`,
  },
  // By-category admin review queue (submission = categories for an event+sport).
  categorySubmissions: {
    list: '/api/v1/surveys/category/submissions',
    byId: (id: number) => `/api/v1/surveys/category/submissions/${id}`,
    review: (id: number) => `/api/v1/surveys/category/submissions/${id}/review`,
    reviewSport: (sportId: number) => `/api/v1/surveys/category/submissions/sport/${sportId}/review`,
  },
  survey: {
    events: '/api/v1/events?survey_sport_open=true&skip=0&limit=100',
    sports: '/api/v1/sports?skip=0&limit=200',
    organizations: '/api/v1/organization?skip=0&limit=100',
    eventSports: (eventId: number) => `/api/v1/events/${eventId}/sports`,
    orgSports: (eventId: number, orgId: number) => `/api/v1/events/${eventId}/org-sports/${orgId}`,
    addOrgToSport: '/api/v1/events/add-org-to-sport',
  },
  bynumber: {
    events: '/api/v1/events?survey_number_open=true&skip=0&limit=100',
    sports: '/api/v1/sports?skip=0&limit=200',
    organizations: '/api/v1/organization?skip=0&limit=100',
    eventSports: (eventId: number) => `/api/v1/events/${eventId}/sports`,
    sportOrgs: (eventId: number, sportId: number) => `/api/v1/events/${eventId}/sports/${sportId}/orgs`,
    sportsList: '/api/v1/sports?limit=200',
    createParticipation: '/api/v1/participation-per-sport',
  },
  dashboard: {
    data: '/api/v1/dashboard',
  },
  reports: {
    generate: (key: string) => `/api/v1/reports/${key}`,
  },

  cards: {
    byId: (pId: string, orgId: string, eventId: string) => `/api/v1/card/${pId}/${orgId}/${eventId}`,
    list: (orgId: string, eventId: string) => `/api/v1/cards/${orgId}/${eventId}`,
  },
  participant: {
    base: '/api/v1/registration',
  },
  organizer: {
    register: '/api/v1/registration/organizer',
    roles: '/api/v1/organizer-roles',
    roleById: (id: number) => `/api/v1/organizer-roles/${id}`,
  },
  bycategory: {
    eligibleEvents: '/api/v1/events?survey_category_open=true&skip=0&limit=100',
    categories: (eventId: number, sportId: number) => `/api/v1/surveys/category?event_id=${eventId}&sport_id=${sportId}`,
    upsert: '/api/v1/surveys/category',
  },
  openSurvey: {
    events: '/api/v1/events?skip=0&limit=100',
    // Shared by GET (fill view) and POST (upsert). organization_id is ignored
    // server-side for ORG users (forced to their own org). No PII in the URL.
    responses: (eventId: number, organizationId?: number) => `/api/v1/surveys/open/responses?event_id=${eventId}` + (organizationId ? `&organization_id=${organizationId}` : ''),
    // Admin field management (producer side). GET lists an event's fields,
    // POST (createField URL) adds one. Only event_id/field_id in the URL — no PII.
    fields: (eventId: number, includeInactive = false) => `/api/v1/surveys/open/fields?event_id=${eventId}` + (includeInactive ? '&include_inactive=true' : ''),
    createField: (eventId: number) => `/api/v1/surveys/open/fields?event_id=${eventId}`,
    field: (fieldId: number) => `/api/v1/surveys/open/fields/${fieldId}`,
  },
} as const;
