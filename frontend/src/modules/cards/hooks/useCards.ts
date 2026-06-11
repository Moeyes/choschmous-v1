'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { cardsRepository } from '../adapters';

export function useCards(orgId: string, eventId: string, page = 1) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cards.list(orgId, eventId, page),
    queryFn: () => cardsRepository.getCards(orgId, eventId, page),
    enabled: !!(orgId && eventId),
    // Cards carry participant name + photo — Restricted-PII, so not retained
    // past the screen (data-governance §3/§5). placeholderData keeps pagination
    // smooth at the observer level, independent of gcTime.
    staleTime: 0,
    gcTime: 0,
    placeholderData: (previousData) => previousData,
  });

  return { 
    cards: data?.items || [], 
    total: data?.total || 0, 
    isLoading, 
    error 
  };
}
