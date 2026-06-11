import apiClient from '@/core/api/client';
import unauthenticatedApiClient from '@/core/api/unauthenticatedApiClient';
import { LoginRequest, User } from '@/core/auth/types';
import { recordAccessTokenExpiry } from '@/core/auth/tokenExpiry';

const BASE = '/api/auth';

// --- Types -----------------------------------------------------------

type AuthResponse = {
    detail: string;
    access_token_expires_at?: number;
};

// --- API calls -------------------------------------------------------

/**
 * POST /api/auth/login
 * Sends credentials → backend sets HttpOnly cookies and returns the access
 * token's expiry (not the token) in the body.
 */
export async function loginUser(credentials: LoginRequest): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(`${BASE}/login`, credentials);
    // Record the expiry so the next page load knows whether to refresh before /me.
    recordAccessTokenExpiry(data.access_token_expires_at);
    return data;
}

/**
 * POST /api/auth/refresh
 * Browser sends refresh_token HttpOnly cookie automatically; backend rotates the
 * tokens (as cookies) and returns the new access token's expiry.
 */
export async function refreshAccessToken(): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(`${BASE}/refresh`, {});
    // Keep the expiry hint in sync with the rotated token.
    recordAccessTokenExpiry(data.access_token_expires_at);
    return data;
}

/**
 * GET /api/auth/me
 * Resolve the current user straight from the HttpOnly `access_token` cookie —
 * a single-round-trip "who am I?" with no user id in the URL and no client-side
 * token decoding. This is what lets the session be restored on load without
 * persisting any user data in the browser.
 */
export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
    const { data } = await apiClient.get<User>(`${BASE}/me`, { signal });
    // The backend (UserPublic) only sends `organization_id`. Mirror it onto the
    // legacy `org_id` alias so every consumer can rely on `user.org_id` for
    // org scoping regardless of which name it reads.
    return { ...data, org_id: data.organization_id ?? data.org_id ?? null };
}

/**
 * Logout: tell the backend to revoke the refresh token and clear the auth
 * cookies, then AuthContext dispatches LOGOUT to wipe in-memory state.
 * Without this server call the HttpOnly refresh_token cookie survives and the
 * session is silently restored on the next page load.
 */
export async function logoutUser(): Promise<void> {
    await unauthenticatedApiClient.post(`${BASE}/logout`, {});
}

// authService is intentionally omitted — import the individual functions directly