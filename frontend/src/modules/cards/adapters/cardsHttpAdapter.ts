import type { ICardRepository } from '../ports/ICardRepository';
import type { CardData, PaginatedCardsResponse } from '../schema/cards.schema';
import { cardDataSchema, paginatedCardsResponseSchema } from '../schema/cards.schema';
import { apiGetCard, apiGetCards } from '../api';

export const cardsHttpAdapter: ICardRepository = {
    async getCard(pId: string, orgId: string, eventId: string) {
        return cardDataSchema.parse(await apiGetCard(pId, orgId, eventId)) as CardData;
    },
    async getCards(orgId: string, eventId: string, page = 1, pageSize = 12) {
        return paginatedCardsResponseSchema.parse(
            await apiGetCards(orgId, eventId, { page, page_size: pageSize })
        ) as PaginatedCardsResponse;
    },
};
