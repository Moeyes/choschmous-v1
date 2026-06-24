import apiClient from '@/core/api/client';
import { recordAccessTokenExpiry } from '@/core/auth/tokenExpiry';

/**
 * Multi-factor authentication client (CHOS-401).
 *
 * The login flow is two-legged for MFA-enrolled accounts: POST /auth/login
 * validates the password and, when a second factor is required, returns
 * `{ mfa_required: true, mfa_token, methods }` *without* setting session cookies.
 * The UI then collects the second factor and calls {@link verifyMfaLogin}, which
 * trades the challenge token for the real session.
 */

const BASE = '/api/v1/auth';

export type MfaMethod = 'totp' | 'recovery' | 'webauthn';

/** Shape of the /auth/login body when a second factor is outstanding. */
export interface MfaLoginChallenge {
    mfa_required: true;
    mfa_token: string;
    methods: MfaMethod[];
    /** True when a privileged account must ENROL before it can finish login. */
    mfa_enrollment_required?: boolean;
}

export function isMfaChallenge(body: unknown): body is MfaLoginChallenge {
    return (
        typeof body === 'object' &&
        body !== null &&
        (body as { mfa_required?: unknown }).mfa_required === true
    );
}

/**
 * Thrown by `loginUser` when the backend returns an MFA challenge instead of a
 * session. Carries everything the login UI needs to render the second-factor
 * step. Modelled as an error so the existing "login succeeded → who am I?" happy
 * path stays a single straight-line await.
 */
export class MfaRequiredError extends Error {
    readonly mfaToken: string;
    readonly methods: MfaMethod[];
    readonly enrollmentRequired: boolean;

    constructor(challenge: MfaLoginChallenge) {
        super('Multi-factor authentication required');
        this.name = 'MfaRequiredError';
        this.mfaToken = challenge.mfa_token;
        this.methods = challenge.methods ?? [];
        this.enrollmentRequired = challenge.mfa_enrollment_required ?? false;
    }
}

interface AuthResponse {
    detail: string;
    access_token_expires_at?: number;
}

/** Second leg of an MFA login. On success the backend sets the session cookies. */
export async function verifyMfaLogin(input: {
    mfaToken: string;
    method: MfaMethod;
    code?: string;
    webauthnCredential?: Record<string, unknown>;
    webauthnChallenge?: string;
}): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(`${BASE}/mfa/verify`, {
        mfa_token: input.mfaToken,
        method: input.method,
        code: input.code,
        webauthn_credential: input.webauthnCredential,
        webauthn_challenge: input.webauthnChallenge,
    });
    recordAccessTokenExpiry(data.access_token_expires_at);
    return data;
}

// --- Enrolment management (used by the account-security settings UI) ---------

export interface MfaStatus {
    role_requires_mfa: boolean;
    enforced: boolean;
    totp_enabled: boolean;
    totp_pending: boolean;
    webauthn_enabled: boolean;
    webauthn_count: number;
    recovery_codes_remaining: number;
}

export async function getMfaStatus(): Promise<MfaStatus> {
    const { data } = await apiClient.get<MfaStatus>(`${BASE}/mfa/status`);
    return data;
}

export async function enrollTotp(): Promise<{ secret: string; otpauth_uri: string }> {
    const { data } = await apiClient.post<{ secret: string; otpauth_uri: string }>(
        `${BASE}/mfa/totp/enroll`,
    );
    return data;
}

export async function activateTotp(code: string): Promise<{ recovery_codes: string[] }> {
    const { data } = await apiClient.post<{ recovery_codes: string[] }>(
        `${BASE}/mfa/totp/activate`,
        { code },
    );
    return data;
}

export async function regenerateRecoveryCodes(): Promise<{ recovery_codes: string[] }> {
    const { data } = await apiClient.post<{ recovery_codes: string[] }>(
        `${BASE}/mfa/recovery/regenerate`,
    );
    return data;
}

export async function disableMfa(code: string): Promise<void> {
    await apiClient.post(`${BASE}/mfa/disable`, { code });
}
