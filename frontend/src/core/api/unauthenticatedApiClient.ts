/**
 * Unauthenticated API Client
 *
 * Axios instance for public endpoints that don't require auth tokens.
 */

import axios, { type AxiosInstance, AxiosError } from 'axios';

const unauthenticatedApiClient: AxiosInstance = axios.create({
    baseURL: '/',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Response interceptor: normalize error shape (same as auth client)
unauthenticatedApiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response) {
            // Preserve the HTTP status so callers can distinguish an auth
            // rejection (401/403) from a network failure. Without this, a 401
            // gets stripped to just its body and is misread as a network blip.
            return Promise.reject({
                status: error.response.status,
                ...(error.response.data as object),
            });
        }
        return Promise.reject({
            detail: error.message || 'An unexpected error occurred',
        });
    }
);

export default unauthenticatedApiClient;