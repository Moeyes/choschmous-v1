import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { attachCrossCuttingHeaders } from './headers';
import {
    recordAccessTokenExpiry,
    clearAccessTokenExpiry,
    isAccessTokenExpired,
} from '@/core/auth/tokenExpiry';

const apiClient: AxiosInstance = axios.create({
    baseURL: '/',
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // sends HttpOnly cookies on every request automatically
});

// The auth endpoints must never be gated on / retried via a refresh: refreshing
// before a login/refresh/logout call makes no sense and would recurse.
const isAuthEndpoint = (url?: string): boolean =>
    !!url && /\/api\/auth\/(login|refresh|logout)/.test(url);

// A single in-flight refresh shared by BOTH the proactive request interceptor
// and the reactive 401 handler, so concurrent requests trigger at most one
// POST /api/auth/refresh. Uses the base `axios` (not apiClient) so it does not
// re-enter these interceptors.
let refreshPromise: Promise<void> | null = null;

function performRefresh(): Promise<void> {
    if (!refreshPromise) {
        refreshPromise = axios
            .post<{ access_token_expires_at?: number }>('/api/auth/refresh', {}, { withCredentials: true })
            .then(({ data }) => {
                // Keep the expiry hint in sync with the rotated token.
                recordAccessTokenExpiry(data?.access_token_expires_at);
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

// Request interceptor: attach cross-cutting headers, then PROACTIVELY refresh.
// The access token lives in an HttpOnly cookie we can't read here, so we consult
// the expiry hint recorded at login/refresh (decoded from the JWT `exp`, with a
// 60s buffer — see tokenExpiry.ts). If it says the token has (nearly) expired,
// refresh BEFORE the request goes out, so an authenticated call carries a live
// cookie instead of bouncing off a 401. If the refresh fails we let the request
// proceed; the response interceptor below turns the resulting 401 into a clean
// session-expired, exactly as before.
apiClient.interceptors.request.use(async (config) => {
    const next = attachCrossCuttingHeaders(config);
    if (!isAuthEndpoint(next.url) && isAccessTokenExpired()) {
        try {
            await performRefresh();
        } catch {
            /* fall through — reactive 401 handling below takes over */
        }
    }
    return next;
});

// Response interceptor: reactive safety net. If a request still 401s (e.g. the
// expiry hint was missing/stale, or the cookie was cleared out-of-band), refresh
// once and retry. This keeps the app working even when the proactive layer is
// wrong.
apiClient.interceptors.response.use(
    res => res,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (
            error.response?.status !== 401 ||
            original._retry ||
            isAuthEndpoint(original.url)
        ) {
            return Promise.reject(error);
        }

        original._retry = true;

        try {
            await performRefresh();
            return apiClient(original);
        } catch {
            clearAccessTokenExpiry();
            window.dispatchEvent(new CustomEvent('auth:session-expired'));
            return Promise.reject(error);
        }
    }
);

export default apiClient;
