import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { SearchRequest } from '../schema/search.schema';

/**
 * POST the query (never GET) so search terms — which may contain a person's
 * name — stay out of URLs, browser history, and access logs.
 */
export async function apiSearch(payload: SearchRequest) {
    const { data } = await apiClient.post<unknown>(API.search.base, payload);
    return data;
}
