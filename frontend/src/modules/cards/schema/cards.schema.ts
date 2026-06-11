import { z } from 'zod';

export const cardDataSchema = z.object({
    pId: z.string(),
    orgId: z.string(),
    eventId: z.string(),
    participantName: z.string(),
    prefix: z.string(),
    photoUrl: z.string().optional(),
    categoryLetter: z.string(),
    sportName: z.string(),
    cardUuid: z.string(),
    eventDateLine: z.string().optional(),
    subtitleKh: z.string().optional(),
    orgName: z.string().optional(),
    eventName: z.string().optional(),
});

export const paginatedCardsResponseSchema = z.object({
    items: z.array(cardDataSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
});

export type CardData = z.infer<typeof cardDataSchema>;
export type PaginatedCardsResponse = z.infer<typeof paginatedCardsResponseSchema>;
