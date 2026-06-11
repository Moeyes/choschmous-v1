import apiClient from '@/core/api/client';

interface EventReference {
    id: number;
    name_kh: string;
    name_en: string;
    type?: string;
}

export interface OrganizationReference {
    id: number;
    name_kh: string;
    name_en: string;
    code?: string;
}

export interface SportReference {
    id: number;
    sport_type: string;
    name_kh: string;
    name_en?: string;
}

export interface CategoryReference {
    id: number;
    category: string;
    sport_name?: string;
    gender?: string;
    created_at?: string;
}

export interface CascadingDataLoaded {
    eventTypes: string[];
    events: EventReference[];
    organizations: OrganizationReference[];
    sports: SportReference[];
}

async function fetchEvents(): Promise<EventReference[]> {
    try {
        const response = await apiClient.get('/api/events', {
            params: { skip: 0, limit: 100 },
        });
        return response.data.data || [];
    } catch {
        return [];
    }
}

export async function fetchAllOrganizations(): Promise<OrganizationReference[]> {
    try {
        const response = await apiClient.get('/api/organization', {
            params: { skip: 0, limit: 100 },
        });
        return response.data.data || [];
    } catch {
        return [];
    }
}

export async function fetchAllSports(): Promise<SportReference[]> {
    try {
        const response = await apiClient.get('/api/sports', {
            params: { skip: 0, limit: 100 },
        });
        return response.data.data || [];
    } catch {
        return [];
    }
}

export async function fetchCategories(
    eventId: number,
    sportId: number
): Promise<CategoryReference[]> {
    try {
        const response = await apiClient.get(`/api/events/${eventId}/sports/${sportId}/categories`);
        return Array.isArray(response.data) ? response.data : [];
    } catch {
        return [];
    }
}

function getUniqueEventTypes(events: EventReference[]): string[] {
    const types = new Set<string>();
    events.forEach((event) => {
        if (event.type) types.add(event.type);
    });
    return Array.from(types).sort();
}

export async function loadCascadingData(): Promise<CascadingDataLoaded> {
    try {
        const [events, organizations, sports] = await Promise.all([
            fetchEvents(),
            fetchAllOrganizations(),
            fetchAllSports(),
        ]);
        return {
            eventTypes: getUniqueEventTypes(events),
            events,
            organizations,
            sports,
        };
    } catch {
        return { eventTypes: [], events: [], organizations: [], sports: [] };
    }
}