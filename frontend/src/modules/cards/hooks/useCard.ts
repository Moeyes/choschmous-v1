'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { cardsRepository } from '../adapters';

export function useCard(pId: string, orgId: string, eventId: string) {
  const { data: card, isLoading, error } = useQuery({
    queryKey: queryKeys.cards.one(pId, orgId, eventId),
    queryFn: () => cardsRepository.getCard(pId, orgId, eventId),
    enabled: !!(pId && orgId && eventId),
    // Card carries participant name + photo — Restricted-PII (data-governance §3/§5).
    staleTime: 0,
    gcTime: 0,
  });

  return { card, isLoading, error };
}
