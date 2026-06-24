import * as z from 'zod';

/** Entity types the palette can surface. Mirrors the backend SearchType. */
export const SEARCH_TYPES = ['event', 'organization', 'athlete'] as const;
export const searchTypeSchema = z.enum(SEARCH_TYPES);
export type SearchType = z.infer<typeof searchTypeSchema>;

/**
 * One minimized hit. The backend never returns PII beyond the display name, so
 * the schema deliberately has no phone/DOB/etc. fields — parsing with .strict()
 * would reject any such leak.
 */
export const searchHitSchema = z
    .object({
        type:     searchTypeSchema,
        id:       z.number().int(),
        title:    z.string(),
        subtitle: z.string().nullable().optional(),
    })
    .strict();

export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchResponseSchema = z
    .object({
        data:  searchHitSchema.array(),
        count: z.number().int().nonnegative(),
    })
    .strict();

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export interface SearchRequest {
    query: string;
    types?: SearchType[];
    limit?: number;
}
