import apiClient from '@/core/api/client';
import { API } from '@/core/api/endpoints';
import type { RegisterPayload } from '../types';

export async function apiRegisterParticipant(payload: RegisterPayload) {
    const { data } = await apiClient.post(`${API.registration.base}`, payload);
    return data;
}

/**
 * List/search registrations. Filters (incl. the free-text `search`, which may
 * contain names or phone numbers) go in the POST body, never the URL, so
 * Restricted-PII stays out of browser history, referrers and access logs
 * (data-governance §3). The backend POST /search mirrors the GET list, with the
 * same org scoping derived from the auth token.
 */
export async function apiSearchRegistrations(params?: Record<string, unknown>) {
    const { skip, ...rest } = params ?? {};
    const { data } = await apiClient.post(API.registration.search, { ...rest, offset: skip });
    return data;
}

/**
 * Reveal a participant's masked phone. POST (no body) so the action is a
 * deliberate, CSRF-protected request; the backend is admin-only and audits the
 * access (data-governance §4/§6).
 */
export async function apiRevealParticipantPii(enrollId: number) {
    const { data } = await apiClient.post(API.registration.reveal(enrollId), {});
    return data;
}

// The detail endpoint needs `role` to know which table (athlete vs leader) to
// read from — it's a required query param server-side.
export async function apiGetRegistration(enrollId: number, role: string) {
    const { data } = await apiClient.get(API.registration.byId(enrollId), {
        params: { role },
    });
    return data;
}

// Backend expects { enroll_id, role, data: {...partial fields} } — the editable
// fields are nested under `data`, and `role` selects athlete vs leader.
export async function apiUpdateRegistration(
    enrollId: number,
    role: string,
    data: Record<string, unknown>,
) {
    const { data: res } = await apiClient.patch(API.registration.update, {
        enroll_id: enrollId,
        role,
        data,
    });
    return res;
}

export async function apiDeleteRegistration(enrollId: number) {
    const { data } = await apiClient.delete(API.registration.delete, { data: { enroll_id: enrollId } });
    return data;
}
