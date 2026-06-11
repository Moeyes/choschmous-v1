/**
 * Cross-cutting HTTP header / cookie names attached centrally by the API
 * clients' request interceptor. Kept in one place so the backend contract has
 * a single source of truth on the frontend.
 */

/** Header carrying a per-request id used to correlate client/server logs. */
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/** Cookie the backend sets with the double-submit CSRF token (when enabled). */
export const CSRF_COOKIE_NAME = 'csrf_token';

/** Header the CSRF token is echoed back on for state-changing requests. */
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** Methods that mutate state and therefore carry the CSRF token. */
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
