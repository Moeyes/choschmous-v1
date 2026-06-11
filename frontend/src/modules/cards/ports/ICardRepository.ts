import type { CardData, PaginatedCardsResponse } from '../schema/cards.schema';

export interface ICardRepository {
    getCard(pId: string, orgId: string, eventId: string): Promise<CardData>;
    getCards(orgId: string, eventId: string, page?: number, pageSize?: number): Promise<PaginatedCardsResponse>;
}
