import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';

export async function apiFetchEligibleEvents() {
  const response = await apiClient.get(API.bycategory.eligibleEvents);
  return response.data;
}

export async function apiFetchCategories(eventId: number, sportId: number) {
  const response = await apiClient.get(API.bycategory.categories(eventId, sportId));
  return response.data;
}

export async function apiFetchPreviousCategories(eventId: number, sportId: number) {
  const response = await apiClient.get(API.bycategory.categories(eventId, sportId));
  return response.data;
}

export async function apiSubmitCategories(body: Record<string, unknown>) {
  const response = await apiClient.post(API.bycategory.upsert, body);
  return response.data;
}

export async function apiFetchSport(sportId: number) {
  const response = await apiClient.get(API.sports.byId(sportId));
  return response.data;
}
