'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useReducer,
    useRef,
} from 'react';
import { AuthContextType, AuthState, User, UserRole } from '@/core/auth/types';
import {
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
} from '@/core/auth/services';
import { queryClient } from '@/core/api/queryClient';
import { logger } from '@/core/lib/logger';
import { isAccessTokenExpired, clearAccessTokenExpiry } from '@/core/auth/tokenExpiry';

// --- Role normalisation ----------------------------------------------

function normalizeRole(raw: string): UserRole {
    // The UserRole enum values now match the backend strings exactly
    // (super_admin / admin / organization / federation), so the role is read
    // straight from the API value — no USER1/USER2 remapping. GUEST remains a
    // defensive fallback for any unexpected/unknown value.
    const valid = Object.values(UserRole) as string[];
    if (valid.includes(raw)) return raw as UserRole;
    logger.warn('auth.unknown_role');
    return UserRole.GUEST;
}

// --- Reducer ---------------------------------------------------------

type Action =
    | { type: 'LOADING' }
    | { type: 'SET_USER'; user: User; role: UserRole }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'CLEAR_ERROR' }
    | { type: 'LOGOUT' };

const EMPTY: AuthState = {
    user: null, role: null,
    isAuthenticated: false, isLoading: false, error: null,
};

function reducer(state: AuthState, action: Action): AuthState {
    switch (action.type) {
        case 'LOADING':     return { ...state, isLoading: true, error: null };
        case 'SET_USER':    return { ...EMPTY, isAuthenticated: true, user: action.user, role: action.role };
        case 'SET_ERROR':   return { ...state, isLoading: false, error: action.error };
        case 'CLEAR_ERROR': return { ...state, error: null };
        case 'LOGOUT':      return { ...EMPTY };
        default:            return state;
    }
}

// --- Helpers ---------------------------------------------------------

/**
 * Returns true only for HTTP responses that explicitly reject the session.
 * Network errors, timeouts, 500s, etc. are NOT auth failures.
 */
function isAuthRejection(err: unknown): boolean {
    if (err == null || typeof err !== 'object') return false;

    // Axios-style: err.response.status
    if (
        'response' in err &&
        err.response != null &&
        typeof err.response === 'object' &&
        'status' in err.response &&
        (err.response.status === 401 || err.response.status === 403)
    ) return true;

    // Flat-style: err.status
    if (
        'status' in err &&
        (err.status === 401 || err.status === 403)
    ) return true;

    return false;
}

// --- Context ---------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // No client-side session cache (PII must never be persisted), so on every
    // load we genuinely don't know who the user is until the server tells us.
    // Start in the loading state and verify against the session cookie.
    const [state, dispatch] = useReducer(reducer, { ...EMPTY, isLoading: true });

    const didInit = useRef(false);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const restore = async () => {
            // Verify the session straight from the HttpOnly access_token cookie.
            // `apiClient` transparently refreshes (and retries) on a 401, so a
            // merely-expired access token still resolves here.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10_000);

            try {
                // Proactive refresh: JS can't read the HttpOnly access_token to
                // see if it's expired, so we consult the expiry hint recorded at
                // login/refresh. If it says the token is gone (or we have no
                // hint), refresh FIRST so the /me call below never eats a 401.
                // If the refresh token is also dead this throws → caught below →
                // clean logged-out state (redirect to /login as before).
                if (isAccessTokenExpired()) {
                    await refreshAccessToken();
                }
                const user = await getCurrentUser(controller.signal);
                const role = normalizeRole(user.role as unknown as string);
                dispatch({ type: 'SET_USER', user, role });
            } catch (err) {
                // With no session cache to fall back on, any failure to confirm
                // the session (401, failed refresh, network error, or timeout)
                // resolves to a clean logged-out state. Fail closed — never show
                // privileged UI on an unverified session.
                if (!isAuthRejection(err)) {
                    logger.warn('auth.session_unverified');
                }
                clearAccessTokenExpiry();
                dispatch({ type: 'LOGOUT' });
            } finally {
                clearTimeout(timeoutId);
            }
        };

        void restore();
    }, []); // ← empty array: runs ONCE on mount, never on navigation

    // Listen for the global session-expired event fired by the Axios interceptor.
    useEffect(() => {
        const handler = () => {
            queryClient.clear(); // wipe any PII-bearing query cache on session end
            clearAccessTokenExpiry();
            dispatch({ type: 'LOGOUT' });
        };
        window.addEventListener('auth:session-expired', handler);
        return () => window.removeEventListener('auth:session-expired', handler);
    }, []);

    const login = useCallback(async (username: string, password: string): Promise<UserRole> => {
        dispatch({ type: 'LOADING' });
        try {
            // Backend sets the auth cookies; we then ask the server who we are
            // rather than decoding the token or caching the user client-side.
            await loginUser({ username, password });
            const user = await getCurrentUser();
            const role = normalizeRole(user.role as unknown as string);

            dispatch({ type: 'SET_USER', user, role });
            return role;
        } catch (err) {
            dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Login failed' });
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        try { await logoutUser(); } catch { /* intentional no-op */ }
        finally {
            queryClient.clear(); // wipe any PII-bearing query cache on sign-out
            clearAccessTokenExpiry();
            dispatch({ type: 'LOGOUT' });
        }
    }, []);

    const refresh = useCallback(async () => {
        try {
            await refreshAccessToken();
            const user = await getCurrentUser();
            const role = normalizeRole(user.role as unknown as string);
            dispatch({ type: 'SET_USER', user, role });
        } catch (err) {
            if (isAuthRejection(err)) {
                queryClient.clear();
                clearAccessTokenExpiry();
                dispatch({ type: 'LOGOUT' });
            }
            throw err;
        }
    }, []);

    const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

    const hasRole = useCallback(
        (role: UserRole | UserRole[]) => {
            if (!state.role) return false;
            return Array.isArray(role) ? role.includes(state.role) : state.role === role;
        },
        [state.role],
    );

    const canAccess = useCallback(
        (required: UserRole[]) => !!state.role && required.includes(state.role),
        [state.role],
    );

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refresh, clearError, hasRole, canAccess }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
