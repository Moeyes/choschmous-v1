/**
 * ISearchRepository
 *
 * What the search module needs from the data layer — not how it is fetched.
 * Hooks/components depend only on this interface; the HTTP adapter implements it.
 */
import type { SearchRequest, SearchResponse } from '../schema/search.schema';

export interface ISearchRepository {
    search(req: SearchRequest): Promise<SearchResponse>;
}
