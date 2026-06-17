import { useQuery } from '@tanstack/react-query';
import apiClient from '@/core/api/client';
import type { SportReference } from '@/core/api/referenceData';

async function fetchEventSports(eventId: number): Promise<SportReference[]> {
  const response = await apiClient.get(`/api/events/${eventId}/sports`);
  const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
  return data.map((item: { id: number; sport_name?: string; name_kh?: string; name_en?: string }) => ({
    id: item.id,
    sport_type: '',
    name_kh: item.sport_name || item.name_kh || '',
    name_en: item.name_en,
  }));
}

export function useEventSports(eventId: number | null | undefined) {
  return useQuery<SportReference[]>({
    queryKey: ['event-sports', eventId],
    queryFn: () => fetchEventSports(eventId!),
    enabled: !!eventId,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
