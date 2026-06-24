/**
 * Helpers for the cross-cutting request headers attached by the API client's
 * request interceptor. Isolated here so the client stays focused on its
 * refresh/retry concerns.
 */
import type { InternalAxiosRequestConfig } from 'axios';
import {
    CORRELATION_ID_HEADER,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    MUTATING_METHODS,
    TRACEPARENT_HEADER,
} from './constants';
import { createTraceContext, setCurrentTrace } from '@/core/lib/logger';

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function correlationId(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        /* fall through to non-crypto id */
    }
    return `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Attach the correlation id (always) and the double-submit CSRF token (only on
 * state-changing methods, and only when the cookie is present). Until the
 * backend issues the CSRF cookie this is a no-op for that header, so it changes
 * no observable behavior today while wiring the contract for later.
 */
export function attachCrossCuttingHeaders(
    config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
    config.headers.set(CORRELATION_ID_HEADER, correlationId());

    // CHOS-204: propagate a W3C trace context so the backend's OpenTelemetry
    // instrumentation continues this trace — the client action and its server
    // span/logs share one trace_id. Mark it current so client logs emitted while
    // the request is in flight carry the same trace id.
    const trace = createTraceContext();
    setCurrentTrace(trace);
    config.headers.set(TRACEPARENT_HEADER, trace.traceparent);

    const method = (config.method ?? 'get').toUpperCase();
    if (MUTATING_METHODS.has(method)) {
        const token = readCookie(CSRF_COOKIE_NAME);
        if (token) config.headers.set(CSRF_HEADER_NAME, token);
    }

    return config;
}
