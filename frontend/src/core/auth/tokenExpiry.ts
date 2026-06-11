/**
 * Access-token expiry hint — NOT the token itself.
 *
 * The real access_token lives in an HttpOnly cookie, so JavaScript can never
 * read it back on a page reload. That is exactly why the app used to fire a
 * doomed `GET /api/auth/me`, eat a 401, then recover via `POST /api/auth/refresh`:
 * on load it had no way to know the cookie had already expired.
 *
 * The backend does not put the token in the response body either (it stays
 * HttpOnly). What it DOES return from `/login` and `/refresh` is the token's
 * expiry — `access_token_expires_at` (epoch seconds). We persist ONLY that
 * integer to localStorage. No token, no PII — just "when does the current
 * access token stop being valid". On the next load we read this hint and refresh
 * *proactively* when the token has (nearly) expired, so `/me` is only ever
 * called with a live token.
 *
 * This is a hint, not a source of truth. If it is ever missing or wrong (first
 * load before any login, cookie cleared out-of-band, clock skew, storage
 * disabled) we fall back to the reactive 401→refresh interceptor, which still
 * recovers. The hint just removes the 401 in the common case — it must never
 * be able to FORCE a refresh on a session that is actually still valid.
 */

const STORAGE_KEY = 'auth.access_token_exp';

// Treat the token as expired this many seconds early, so an authenticated
// request can't slip across the expiry boundary and 401 on the server.
const EXPIRY_BUFFER_SECONDS = 60;

function safeLocalStorage(): Storage | null {
    try {
        if (typeof window === 'undefined') return null;
        return window.localStorage;
    } catch {
        // localStorage access can throw in private mode / when blocked.
        return null;
    }
}

/**
 * Record the expiry of a freshly issued access token. Called wherever the
 * backend reports a new expiry in a response body (login / refresh). Pass the
 * `access_token_expires_at` value (epoch seconds); a missing/invalid value
 * clears the hint so we fall back to reactive 401 handling.
 */
export function recordAccessTokenExpiry(expiresAt: number | undefined | null): void {
    const store = safeLocalStorage();
    if (!store) return;
    try {
        if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
            store.removeItem(STORAGE_KEY);
        } else {
            store.setItem(STORAGE_KEY, String(Math.floor(expiresAt)));
        }
    } catch {
        /* ignore write failures */
    }
}

/** Forget the stored expiry (on logout / session end). */
export function clearAccessTokenExpiry(): void {
    const store = safeLocalStorage();
    if (!store) return;
    try {
        store.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

/**
 * True only when we have a stored expiry AND it is within
 * EXPIRY_BUFFER_SECONDS of now (or already past). Used to refresh *before*
 * making an authenticated request.
 *
 * Critically, a MISSING or unparseable hint returns false — we do NOT force a
 * refresh on a session we can't prove is expired. Forcing one on every request
 * would churn the single-use refresh-token rotation and can trip the backend's
 * reuse detection, logging the user out spuriously. When the hint is absent we
 * simply let the request go and rely on the reactive 401→refresh safety net.
 */
export function isAccessTokenExpired(): boolean {
    const store = safeLocalStorage();
    if (!store) return false;
    let raw: string | null = null;
    try {
        raw = store.getItem(STORAGE_KEY);
    } catch {
        return false;
    }
    if (raw == null) return false; // no hint → don't force a refresh; fall back to reactive
    const exp = Number(raw);
    if (!Number.isFinite(exp)) return false;
    const nowSeconds = Date.now() / 1000;
    return nowSeconds >= exp - EXPIRY_BUFFER_SECONDS;
}
