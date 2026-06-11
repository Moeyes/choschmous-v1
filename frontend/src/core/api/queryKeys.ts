/**
 * Central React Query key registry.
 *
 * Single source of truth for every queryKey used across the app.
 */
export const queryKeys = {
  referenceData: {
    // Cascading reference data (events + organizations + sports) for the
    // registration flow. Kept distinct from events.all — that key holds a raw
    // Event[] from useEvents; this holds a CascadingDataLoaded object.
    cascading: ['reference-data', 'cascading'] as const,
  },
  events: {
    all: ['events'] as const,
    detail: (eventId: string | number) => ['events', eventId] as const,
    sports: (eventId: string | number) => ['events', eventId, 'sports'] as const,
    sportOrgs: (eventId: string | number, sportId: string | number | null) => ['events', eventId, 'sports', sportId, 'orgs'] as const,
    organizations: (eventId: string | number) => ['events', eventId, 'organizations'] as const,
  },
  organizations: {
    all: ['organizations'] as const,
    allList: ['organizations', 'all'] as const,
    list: (params?: unknown) => ['organizations', 'list', params] as const,
    detail: (id: number) => ['organizations', 'detail', id] as const,
  },
  sports: {
    all: ['sports'] as const,
    allList: ['sports', 'all'] as const,
    list: (params?: unknown) => ['sports', 'list', params] as const,
    detail: (sportId: string | number) => ['sports', sportId] as const,
    participants: (sportId: string | number, role: string) => ['sport-participants', sportId, role] as const,
  },
  categories: {
    bySport: (sportId: string | number) => ['categories', sportId] as const,
  },
  cards: {
    list: (orgId: string, eventId: string, page: number) => ['cards', orgId, eventId, page] as const,
    one: (pId: string, orgId: string, eventId: string) => ['card', pId, orgId, eventId] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: unknown) => ['users', 'list', params] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  registrations: {
    all: ['registrations'] as const,
    list: <F>(filter: F) => ['registrations', filter] as const,
    detail: (id: number, role: string) => ['registrations', 'detail', id, role] as const,
  },
  participations: {
    all: ['participations'] as const,
    list: <F>(filter: F) => ['participations', filter] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    scoped: (role: string | null | undefined, orgId: number | null | undefined) => ['dashboard', role, orgId] as const,
  },
} as const;
