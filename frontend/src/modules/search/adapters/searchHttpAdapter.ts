/**
 * searchHttpAdapter.ts
 *
 * Concrete HTTP implementation of ISearchRepository. The response is Zod-parsed
 * (.strict()) before leaving this file — an untrusted server response carrying
 * any unexpected (e.g. PII) field would fail parsing rather than reach the UI.
 */
import type { ISearchRepository } from '../ports/ISearchRepository';
import { searchResponseSchema, type SearchRequest } from '../schema/search.schema';
import { apiSearch } from '../api';

export const searchHttpAdapter: ISearchRepository = {
    search: async (req: SearchRequest) =>
        searchResponseSchema.parse(await apiSearch(req)),
};
